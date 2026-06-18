'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface GroupParticipant {
  key: string;
  name: string;
  role: 'host' | 'guest';
  roomLabel?: string | null;
}

export interface UseGroupSyncOptions {
  /** Code de session (group_sessions.code) — null désactive le hook (visite solo). */
  code: string | null;
  name: string;
  role: 'host' | 'guest';
  /** Appliqué chez les followers quand l'hôte navigue. */
  onRemoteNav?: (sweepId: string, rotation: { x: number; y: number } | null) => void;
  /** Sous-titre diffusé par l'hôte (narration partagée en mode visio). */
  onRemoteSay?: (text: string) => void;
}

const NAV_THROTTLE_MS = 600;

/**
 * Synchronisation de groupe — Supabase Realtime.
 *
 *  - presence : liste des participants + pièce courante de chacun ;
 *  - broadcast "nav" : l'hôte (agent humain ou meneur) diffuse sa position,
 *    les invités suivent la caméra (visite guidée à plusieurs / mode visio) ;
 *  - broadcast "say" : sous-titres partagés (commentaires de l'agent).
 *
 * Garde anti-écho : un follower qui applique une nav distante ne la
 * rebroadcaste pas (seul l'hôte émet).
 */
export function useGroupSync({ code, name, role, onRemoteNav, onRemoteSay }: UseGroupSyncOptions) {
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [connected, setConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastNavSentRef = useRef(0);
  const applyingRemoteRef = useRef(false);
  const cbRef = useRef({ onRemoteNav, onRemoteSay });
  cbRef.current = { onRemoteNav, onRemoteSay };

  useEffect(() => {
    if (!code) return;
    const supabase = createClient();
    const channel = supabase.channel(`group:${code}`, {
      config: { presence: { key: crypto.randomUUID() }, broadcast: { self: false } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string; role: 'host' | 'guest'; roomLabel?: string | null }>();
        const list: GroupParticipant[] = [];
        for (const [key, metas] of Object.entries(state)) {
          const m = metas[0];
          if (m) list.push({ key, name: m.name, role: m.role, roomLabel: m.roomLabel ?? null });
        }
        list.sort((a, b) => (a.role === 'host' ? -1 : 0) - (b.role === 'host' ? -1 : 0));
        setParticipants(list);
      })
      .on('broadcast', { event: 'nav' }, ({ payload }) => {
        if (role === 'host') return; // l'hôte ne suit personne
        const { sweepId, rotation } = payload as { sweepId: string; rotation: { x: number; y: number } | null };
        applyingRemoteRef.current = true;
        cbRef.current.onRemoteNav?.(sweepId, rotation);
        setTimeout(() => { applyingRemoteRef.current = false; }, 1800);
      })
      .on('broadcast', { event: 'say' }, ({ payload }) => {
        cbRef.current.onRemoteSay?.((payload as { text: string }).text);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          await channel.track({ name, role, roomLabel: null });
        }
      });

    channelRef.current = channel;
    return () => {
      setConnected(false);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name, role]);

  /** Hôte : diffuse sa position (throttlé) — à brancher sur onSweepChange. */
  const broadcastNav = useCallback(
    (sweepId: string, rotation: { x: number; y: number } | null) => {
      if (role !== 'host' || !channelRef.current) return;
      if (applyingRemoteRef.current) return;
      const now = Date.now();
      if (now - lastNavSentRef.current < NAV_THROTTLE_MS) return;
      lastNavSentRef.current = now;
      void channelRef.current.send({ type: 'broadcast', event: 'nav', payload: { sweepId, rotation } });
    },
    [role],
  );

  const broadcastSay = useCallback(
    (text: string) => {
      if (role !== 'host' || !channelRef.current || !text.trim()) return;
      void channelRef.current.send({ type: 'broadcast', event: 'say', payload: { text } });
    },
    [role],
  );

  /** Met à jour la pièce courante dans la presence (affichée dans le panneau groupe). */
  const updateMyRoom = useCallback(
    (roomLabel: string | null) => {
      void channelRef.current?.track({ name, role, roomLabel });
    },
    [name, role],
  );

  return { connected, participants, broadcastNav, broadcastSay, updateMyRoom };
}
