'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Property, PropertyRoom, VisitMode } from '@/lib/types';
import { useMatterport } from '@/hooks/useMatterport';
import { useRealtimeAgent } from '@/hooks/useRealtimeAgent';
import { useGuidedTour } from '@/hooks/useGuidedTour';
import { useGroupSync } from '@/hooks/useGroupSync';
import { roomContextNudge, idleNudge } from '@/lib/ai/prompts';
import { MatterportViewer } from './MatterportViewer';
import { WelcomeOverlay } from './WelcomeOverlay';
import { AgentHud } from './AgentHud';
import { GroupPanel } from './GroupPanel';

const EVENTS_FLUSH_MS = 10_000;
const IDLE_NUDGE_MS = 75_000;

interface VisitExperienceProps {
  property: Property;
  rooms: PropertyRoom[];
  /** Visite de groupe : code de session + rôle (hôte = pilote + IA). */
  group?: { code: string; isHost: boolean } | null;
}

/**
 * Orchestrateur de l'expérience visiteur.
 * Relie les quatre systèmes : SDK Matterport (caméra/position), agent vocal
 * OpenAI Realtime (voix + tools), visite guidée (séquenceur), synchronisation
 * de groupe (Supabase Realtime) — et alimente analytics + CRM en continu.
 */
export function VisitExperience({ property, rooms, group }: VisitExperienceProps) {
  const [phase, setPhase] = useState<'welcome' | 'live' | 'ended'>('welcome');
  const [mode, setMode] = useState<VisitMode>('libre');
  const [remoteCaption, setRemoteCaption] = useState('');

  const visitIdRef = useRef<string | null>(null);
  const modeRef = useRef<VisitMode>('libre');
  const visitorLabelRef = useRef('');
  const endedRef = useRef(false);

  // ---- Mesure du temps par pièce ----
  const roomTimesRef = useRef<Map<string, number>>(new Map());
  const currentRoomRef = useRef<{ label: string; since: number } | null>(null);
  const questionsCountRef = useRef(0);
  const lastInteractionRef = useRef(Date.now());
  const lastNudgeRef = useRef(0);

  // ---- Buffer d'événements (flush périodique) ----
  const eventsRef = useRef<{ type: string; payload?: Record<string, unknown> }[]>([]);
  const logEvent = useCallback((type: string, payload?: Record<string, unknown>) => {
    eventsRef.current.push({ type, payload });
  }, []);

  const settleCurrentRoom = useCallback(() => {
    const cur = currentRoomRef.current;
    if (!cur) return;
    const secs = Math.round((Date.now() - cur.since) / 1000);
    roomTimesRef.current.set(cur.label, (roomTimesRef.current.get(cur.label) ?? 0) + secs);
    currentRoomRef.current = null;
  }, []);

  // ---------------------------------------------------------------
  // Synchronisation de groupe
  // ---------------------------------------------------------------
  const isHost = !group || group.isHost; // visite solo = "hôte" de sa propre session
  const groupSync = useGroupSync({
    code: group?.code ?? null,
    name: visitorLabelRef.current || (group?.isHost ? 'Guide' : 'Invité'),
    role: group?.isHost ? 'host' : 'guest',
    onRemoteNav: (sweepId, rotation) => {
      void mp.moveToSweep(sweepId, rotation ?? undefined);
    },
    onRemoteSay: (text) => {
      setRemoteCaption(text);
      window.setTimeout(() => setRemoteCaption((c) => (c === text ? '' : c)), 7000);
    },
  });

  // ---------------------------------------------------------------
  // Matterport
  // ---------------------------------------------------------------
  const mp = useMatterport({
    modelId: property.matterport_model_id,
    rooms,
    onRoomEnter: (label) => {
      settleCurrentRoom();
      currentRoomRef.current = { label, since: Date.now() };
      logEvent('room_enter', { label });
      groupSync.updateMyRoom(label);

      // Mode libre : commentaire contextuel discret à l'entrée d'une pièce
      if (isHost && modeRef.current === 'libre' && phaseRef.current === 'live') {
        const room = rooms.find((r) => r.label === label);
        agent.injectContext(roomContextNudge(label, room?.talking_points ?? []), true);
      }
    },
    onSweepChange: (sweepId) => {
      lastInteractionRef.current = Date.now();
      if (group?.isHost) {
        groupSync.broadcastNav(sweepId, mp.state.cameraRotation);
      }
    },
  });

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // ---------------------------------------------------------------
  // Visite guidée (séquenceur)
  // ---------------------------------------------------------------
  const tour = useGuidedTour({
    rooms,
    moveToRoom: mp.moveToRoom,
    speak: (instructions) => agent.speakFromContext(instructions),
    onStepChange: (index, room) => logEvent('tour_step', { index, label: room.label }),
    onEnd: () => logEvent('tour_end'),
  });
  const tourRef = useRef(tour);
  tourRef.current = tour;

  // ---------------------------------------------------------------
  // Tools de l'agent (function calling -> actions réelles)
  // ---------------------------------------------------------------
  const handleToolCall = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      logEvent('tool_call', { name });
      switch (name) {
        case 'navigate_to_room': {
          const moved = await mp.moveToRoom(String(args.room ?? ''));
          return moved
            ? { ok: true, moved_to: args.room }
            : { ok: false, error: `Pièce inconnue. Pièces disponibles : ${rooms.map((r) => r.label).join(', ')}` };
        }
        case 'search_property_documents': {
          const res = await fetch('/api/rag/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              propertyId: property.id,
              visitId: visitIdRef.current,
              query: String(args.query ?? ''),
            }),
          });
          questionsCountRef.current += 1;
          return res.ok ? await res.json() : { found: false, error: 'recherche indisponible' };
        }
        case 'analyze_current_view': {
          const image = await mp.takeScreenshot();
          if (!image) return { error: "capture impossible pour l'instant" };
          const res = await fetch('/api/vision/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyId: property.id, image }),
          });
          return res.ok ? await res.json() : { error: 'analyse indisponible' };
        }
        case 'update_lead_qualification':
          void fetch('/api/leads/qualify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              visitId: visitIdRef.current,
              field: args.field,
              value: args.value,
            }),
          });
          return { saved: true };
        case 'capture_contact':
          void fetch('/api/leads/qualify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitId: visitIdRef.current, contact: args }),
          });
          return { saved: true };
        case 'start_guided_tour': {
          modeRef.current = 'guidee';
          setMode('guidee');
          const started = tourRef.current.start();
          return { started };
        }
        case 'stop_guided_tour':
          tourRef.current.stop();
          modeRef.current = 'libre';
          setMode('libre');
          return { stopped: true };
        case 'skip_to_next_stop':
          tourRef.current.skip();
          return { ok: true };
        default:
          return { error: `tool inconnu: ${name}` };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [property.id, rooms],
  );

  // ---------------------------------------------------------------
  // Agent vocal temps réel
  // ---------------------------------------------------------------
  const agent = useRealtimeAgent({
    getSessionPayload: () => ({
      propertyId: property.id,
      visitId: visitIdRef.current,
      mode: modeRef.current,
      visitorLabel: visitorLabelRef.current || undefined,
    }),
    onToolCall: handleToolCall,
    onUserUtterance: () => {
      lastInteractionRef.current = Date.now();
      // Question pendant la visite guidée -> on fige la progression
      if (tourRef.current.status === 'running') tourRef.current.pause();
    },
    onAssistantUtterance: (text) => {
      lastInteractionRef.current = Date.now();
      if (group?.isHost) groupSync.broadcastSay(text);
      // Lancement auto de la visite guidée après le message d'accueil
      if (modeRef.current === 'guidee' && tourRef.current.status === 'off' && !openedTourRef.current) {
        openedTourRef.current = true;
        window.setTimeout(() => tourRef.current.start(), 600);
      }
      // Réponse terminée pendant une pause -> la visite guidée reprend
      if (tourRef.current.status === 'paused') {
        window.setTimeout(() => {
          if (tourRef.current.status === 'paused' && agentStateRef.current !== 'listening') {
            tourRef.current.resume();
          }
        }, 1800);
      }
    },
    onSpeechStarted: () => {
      lastInteractionRef.current = Date.now();
      if (tourRef.current.status === 'running') tourRef.current.pause();
    },
  });
  const openedTourRef = useRef(false);
  const agentStateRef = useRef(agent.state);
  agentStateRef.current = agent.state;

  // ---------------------------------------------------------------
  // Démarrage (geste utilisateur : micro + audio + SDK)
  // ---------------------------------------------------------------
  const start = useCallback(
    async (chosenMode: VisitMode, visitorLabel: string) => {
      modeRef.current = chosenMode;
      visitorLabelRef.current = visitorLabel;
      setMode(chosenMode);

      try {
        const res = await fetch('/api/visits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: property.id,
            mode: chosenMode,
            visitorLabel,
            device: navigator.userAgent.slice(0, 120),
            referrer: document.referrer || undefined,
          }),
        });
        if (res.ok) visitIdRef.current = (await res.json()).visitId;
      } catch { /* la visite continue même sans tracking */ }

      setPhase('live');
      void mp.connect();
      // Invités d'un groupe : pas d'agent vocal propre (ils suivent l'hôte)
      if (isHost) void agent.connect();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [property.id, isHost],
  );

  // ---------------------------------------------------------------
  // Flush périodique des événements + relance après inactivité
  // ---------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'live') return;
    const flush = window.setInterval(() => {
      const batch = eventsRef.current.splice(0, 100);
      if (batch.length && visitIdRef.current) {
        void fetch(`/api/visits/${visitIdRef.current}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: batch }),
          keepalive: true,
        }).catch(() => {});
      }
    }, EVENTS_FLUSH_MS);

    const idle = window.setInterval(() => {
      if (!isHost || modeRef.current !== 'libre') return;
      const silentFor = Date.now() - lastInteractionRef.current;
      const sinceNudge = Date.now() - lastNudgeRef.current;
      if (silentFor > IDLE_NUDGE_MS && sinceNudge > IDLE_NUDGE_MS * 2 && agentStateRef.current === 'idle') {
        lastNudgeRef.current = Date.now();
        agent.injectContext(idleNudge(), true);
      }
    }, 15_000);

    return () => { window.clearInterval(flush); window.clearInterval(idle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isHost]);

  // ---------------------------------------------------------------
  // Clôture de visite (bouton, fermeture d'onglet)
  // ---------------------------------------------------------------
  const buildEndPayload = useCallback(() => {
    settleCurrentRoom();
    return JSON.stringify({
      roomsVisited: [...roomTimesRef.current.entries()].map(([label, seconds]) => ({ label, seconds })),
      transcript: agent.getTranscript(),
      questionsCount: questionsCountRef.current,
    });
  }, [agent, settleCurrentRoom]);

  const endVisit = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    tourRef.current.stop();
    agent.disconnect();
    if (visitIdRef.current) {
      void fetch(`/api/visits/${visitIdRef.current}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildEndPayload(),
        keepalive: true,
      }).catch(() => {});
    }
    setPhase('ended');
  }, [agent, buildEndPayload]);

  useEffect(() => {
    const onHide = () => {
      if (endedRef.current || !visitIdRef.current || phaseRef.current !== 'live') return;
      endedRef.current = true;
      navigator.sendBeacon(
        `/api/visits/${visitIdRef.current}/end`,
        new Blob([buildEndPayload()], { type: 'application/json' }),
      );
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [buildEndPayload]);

  // ---------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------
  const tourBadge =
    tour.status === 'running' || tour.status === 'paused'
      ? `Visite guidée · ${Math.min(tour.stepIndex + 1, tour.totalSteps)}/${tour.totalSteps}${tour.currentRoom ? ` · ${tour.currentRoom.label}` : ''}`
      : null;

  return (
    <div className="visit-theme fixed inset-0 overflow-hidden">
      <MatterportViewer iframeRef={mp.iframeRef} src={mp.iframeSrc} />

      {phase === 'welcome' && (
        <WelcomeOverlay property={property} groupMode={!!group && !group.isHost} onStart={start} />
      )}

      {phase === 'live' && group && (
        <GroupPanel code={group.code} participants={groupSync.participants} />
      )}

      {phase === 'live' && isHost && (
        <AgentHud
          agentName={property.agent_name}
          state={agent.state}
          caption={agent.caption}
          muted={agent.muted}
          tourBadge={tourBadge}
          onToggleMute={agent.toggleMute}
          onSkip={tour.status === 'running' || tour.status === 'paused' ? tour.skip : undefined}
          onEnd={endVisit}
        />
      )}

      {phase === 'live' && !isHost && remoteCaption && (
        <p className="absolute inset-x-0 bottom-8 z-20 mx-auto max-w-2xl px-4 text-center text-sm leading-relaxed text-porcelain/90 drop-shadow">
          {remoteCaption}
        </p>
      )}

      {phase === 'ended' && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-ink/85 backdrop-blur-md">
          <div className="mx-4 max-w-sm animate-fade-up rounded-3xl border border-porcelain/10 bg-ink-800/90 p-8 text-center">
            <p className="font-display text-2xl text-porcelain">Merci pour votre visite</p>
            <p className="mt-3 text-sm leading-relaxed text-porcelain/60">
              L'agence revient vers vous très vite. Vous pouvez relancer la visite à tout moment.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-xl bg-brass px-6 py-3 font-medium text-ink transition hover:bg-brass-soft"
            >
              Revisiter le bien
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
