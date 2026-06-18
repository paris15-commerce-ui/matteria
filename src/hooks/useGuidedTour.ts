'use client';

import { useCallback, useRef, useState } from 'react';
import type { PropertyRoom } from '@/lib/types';
import { tourStepInstructions, tourEndInstructions } from '@/lib/ai/prompts';

export type TourStatus = 'off' | 'running' | 'paused' | 'done';

export interface UseGuidedTourOptions {
  rooms: PropertyRoom[];
  /** Déplace la caméra vers une pièce (useMatterport.moveToRoom). */
  moveToRoom: (label: string) => Promise<boolean>;
  /** Fait parler l'agent avec des instructions hors-bande et attend la fin (useRealtimeAgent.speakFromContext). */
  speak: (instructions: string) => Promise<void>;
  onStepChange?: (index: number, room: PropertyRoom) => void;
  onEnd?: () => void;
}

const STEP_SETTLE_MS = 900; // laisse la transition caméra se poser avant de parler

/**
 * Visite guidée : l'IA pilote la caméra pièce par pièce et commente.
 *
 * Machine à états simple : pour chaque étape -> FLY caméra -> narration
 * (attente de la fin de la réponse audio) -> étape suivante. Si le visiteur
 * prend la parole (VAD), le composant parent appelle pause() ; l'agent répond
 * à la question, puis resume() reprend là où la visite s'était arrêtée.
 */
export function useGuidedTour({ rooms, moveToRoom, speak, onStepChange, onEnd }: UseGuidedTourOptions) {
  const steps = rooms
    .filter((r) => r.include_in_tour)
    .sort((a, b) => a.tour_order - b.tour_order);

  const [status, setStatus] = useState<TourStatus>('off');
  const [stepIndex, setStepIndex] = useState(-1);

  const statusRef = useRef<TourStatus>('off');
  const indexRef = useRef(-1);
  const runIdRef = useRef(0); // invalide les boucles obsolètes (stop/restart)
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const setStatusBoth = (s: TourStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const runStep = useCallback(
    async (index: number, runId: number) => {
      const list = stepsRef.current;
      if (runId !== runIdRef.current) return;

      if (index >= list.length) {
        setStatusBoth('done');
        await speak(tourEndInstructions()).catch(() => {});
        onEnd?.();
        return;
      }

      const room = list[index];
      indexRef.current = index;
      setStepIndex(index);
      onStepChange?.(index, room);

      await moveToRoom(room.label).catch(() => false);
      await new Promise((r) => setTimeout(r, STEP_SETTLE_MS));
      if (runId !== runIdRef.current || statusRef.current !== 'running') return;

      await speak(
        tourStepInstructions({ room, index, total: list.length }),
      ).catch(() => {});

      if (runId !== runIdRef.current || statusRef.current !== 'running') return;

      // courte respiration entre deux pièces
      await new Promise((r) => setTimeout(r, 700));
      if (runId !== runIdRef.current || statusRef.current !== 'running') return;

      void runStep(index + 1, runId);
    },
    [moveToRoom, speak, onStepChange, onEnd],
  );

  const start = useCallback(() => {
    if (stepsRef.current.length === 0) return false;
    runIdRef.current += 1;
    setStatusBoth('running');
    void runStep(0, runIdRef.current);
    return true;
  }, [runStep]);

  /** Le visiteur parle : on fige la progression, l'agent répond librement. */
  const pause = useCallback(() => {
    if (statusRef.current === 'running') setStatusBoth('paused');
  }, []);

  /** Reprend la visite à l'étape suivante (la pièce courante a déjà été commentée). */
  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    runIdRef.current += 1;
    setStatusBoth('running');
    void runStep(indexRef.current + 1, runIdRef.current);
  }, [runStep]);

  const skip = useCallback(() => {
    if (statusRef.current === 'off' || statusRef.current === 'done') return;
    runIdRef.current += 1;
    setStatusBoth('running');
    void runStep(indexRef.current + 1, runIdRef.current);
  }, [runStep]);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    setStatusBoth('off');
    indexRef.current = -1;
    setStepIndex(-1);
  }, []);

  return {
    status,
    stepIndex,
    totalSteps: steps.length,
    currentRoom: stepIndex >= 0 ? steps[stepIndex] ?? null : null,
    start,
    pause,
    resume,
    skip,
    stop,
  };
}
