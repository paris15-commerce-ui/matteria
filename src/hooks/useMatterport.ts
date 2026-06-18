'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MpSdk, PropertyRoomLike, SweepData, RoomData, Vector3 } from './matterport-helpers';
import { distance2D, nearestSweep, loadShowcaseScript } from './matterport-helpers';

export interface MatterportState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  currentSweepId: string | null;
  currentRoomLabel: string | null;
  cameraRotation: { x: number; y: number } | null;
}

export interface UseMatterportOptions {
  modelId: string;
  rooms: PropertyRoomLike[];
  /** Appelé quand le visiteur entre dans une pièce identifiée (debounced). */
  onRoomEnter?: (label: string) => void;
  onSweepChange?: (sweepId: string, position: Vector3 | null) => void;
}

/**
 * Pilote le Showcase SDK Matterport :
 *  - suit en continu position (sweep), orientation (pose) et pièce courante ;
 *  - permet de déplacer la caméra vers une pièce (visite guidée / commande vocale) ;
 *  - capture des screenshots pour l'analyse vision ;
 *  - cartographie sweeps + rooms du modèle pour la synchronisation initiale.
 *
 * Identification de la pièce courante (3 niveaux de robustesse) :
 *  1. Room API du SDK (matterport_room_id mappé en base) ;
 *  2. sweep courant ∈ sweep_ids d'une pièce configurée ;
 *  3. pièce dont le centre (position) est le plus proche du sweep courant.
 */
export function useMatterport({ modelId, rooms, onRoomEnter, onSweepChange }: UseMatterportOptions) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sdkRef = useRef<MpSdk | null>(null);
  const sweepsRef = useRef<Map<string, SweepData>>(new Map());
  const sdkRoomsRef = useRef<Map<string, RoomData>>(new Map());
  const roomsRef = useRef<PropertyRoomLike[]>(rooms);
  const lastRoomRef = useRef<string | null>(null);
  const navigatingRef = useRef(false);
  const subsRef = useRef<{ cancel(): void }[]>([]);

  const [state, setState] = useState<MatterportState>({
    status: 'idle',
    currentSweepId: null,
    currentRoomLabel: null,
    cameraRotation: null,
  });

  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

  const resolveRoomLabel = useCallback((sweepId: string | null, sdkRoomId?: string | null): string | null => {
    const list = roomsRef.current;
    if (sdkRoomId) {
      const byId = list.find((r) => r.matterport_room_id === sdkRoomId);
      if (byId) return byId.label;
    }
    if (!sweepId) return null;
    const bySweep = list.find((r) => r.sweep_ids?.includes(sweepId));
    if (bySweep) return bySweep.label;
    const sweep = sweepsRef.current.get(sweepId);
    if (sweep?.position) {
      let best: { label: string; d: number } | null = null;
      for (const r of list) {
        if (!r.position) continue;
        const d = distance2D(sweep.position, r.position);
        if (!best || d < best.d) best = { label: r.label, d };
      }
      if (best && best.d < 6) return best.label; // < 6 m : on considère la pièce
    }
    return null;
  }, []);

  const emitRoom = useCallback((label: string | null) => {
    if (!label || label === lastRoomRef.current) return;
    lastRoomRef.current = label;
    setState((s) => ({ ...s, currentRoomLabel: label }));
    onRoomEnter?.(label);
  }, [onRoomEnter]);

  /** Connexion : appelée par le onLoad de l'iframe. */
  const connect = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe || sdkRef.current) return;
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      await loadShowcaseScript();
      const sdk = await window.MP_SDK!.connect(
        iframe,
        process.env.NEXT_PUBLIC_MATTERPORT_SDK_KEY ?? '',
        ''
      );
      sdkRef.current = sdk;

      // --- Sweeps (cartographie + position courante) ---
      subsRef.current.push(
        sdk.Sweep.data.subscribe({
          onAdded: (index: string, item: SweepData) => {
            sweepsRef.current.set(item.sid ?? item.id ?? index, { ...item });
          },
          onCollectionUpdated: (collection: Record<string, SweepData>) => {
            for (const [k, v] of Object.entries(collection)) {
              sweepsRef.current.set(v.sid ?? v.id ?? k, { ...v });
            }
          },
        })
      );

      subsRef.current.push(
        sdk.Sweep.current.subscribe((sweep) => {
          if (!sweep?.sid) return;
          setState((s) => ({ ...s, currentSweepId: sweep.sid }));
          onSweepChange?.(sweep.sid, sweep.position ?? null);
          emitRoom(resolveRoomLabel(sweep.sid, null));
        })
      );

      // --- Pose caméra (orientation, throttlée) ---
      let lastPoseAt = 0;
      subsRef.current.push(
        sdk.Camera.pose.subscribe((pose) => {
          const now = Date.now();
          if (now - lastPoseAt < 400) return;
          lastPoseAt = now;
          setState((s) => ({ ...s, cameraRotation: pose.rotation }));
        })
      );

      // --- Room API (si disponible sur ce modèle / cette version SDK) ---
      try {
        subsRef.current.push(
          sdk.Room!.data.subscribe({
            onCollectionUpdated: (collection: Record<string, RoomData>) => {
              for (const [k, v] of Object.entries(collection)) {
                sdkRoomsRef.current.set(v.id ?? k, v);
              }
            },
          })
        );
        subsRef.current.push(
          sdk.Room!.current.subscribe((current) => {
            const id = current?.rooms?.[0]?.id;
            if (id) emitRoom(resolveRoomLabel(null, id));
          })
        );
      } catch {
        /* Room API absente : fallback sweeps/positions, déjà couvert */
      }

      setState((s) => ({ ...s, status: 'ready' }));
    } catch (e) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: e instanceof Error ? e.message : 'Connexion SDK impossible',
      }));
    }
  }, [emitRoom, onSweepChange, resolveRoomLabel]);

  useEffect(() => () => {
    subsRef.current.forEach((s) => { try { s.cancel(); } catch { /* noop */ } });
    try { sdkRef.current?.disconnect(); } catch { /* noop */ }
    sdkRef.current = null;
  }, []);

  /** Déplace la caméra vers une pièce (par libellé). Résout le sweep cible. */
  const moveToRoom = useCallback(async (label: string): Promise<boolean> => {
    const sdk = sdkRef.current;
    if (!sdk) return false;
    const room = roomsRef.current.find(
      (r) => r.label.localeCompare(label, 'fr', { sensitivity: 'base' }) === 0
    ) ?? roomsRef.current.find((r) =>
      r.label.toLowerCase().includes(label.toLowerCase())
    );
    if (!room) return false;

    let targetSweep: string | null = room.sweep_ids?.[0] ?? null;
    if (!targetSweep && room.position) {
      targetSweep = nearestSweep(sweepsRef.current, room.position);
    }
    if (!targetSweep) return false;

    navigatingRef.current = true;
    try {
      await sdk.Sweep.moveTo(targetSweep, {
        transition: sdk.Sweep.Transition.FLY,
        transitionTime: 2200,
      });
      emitRoom(room.label);
      return true;
    } catch {
      return false;
    } finally {
      navigatingRef.current = false;
    }
  }, [emitRoom]);

  /** Déplacement bas niveau (synchro de groupe). */
  const moveToSweep = useCallback(async (sweepId: string, rotation?: { x: number; y: number }) => {
    const sdk = sdkRef.current;
    if (!sdk) return;
    try {
      await sdk.Sweep.moveTo(sweepId, {
        rotation,
        transition: sdk.Sweep.Transition.FLY,
        transitionTime: 1400,
      });
    } catch { /* sweep inaccessible : ignoré */ }
  }, []);

  const setRotation = useCallback(async (rotation: { x: number; y: number }) => {
    try { await sdkRef.current?.Camera.setRotation(rotation, { speed: 90 }); } catch { /* noop */ }
  }, []);

  /** Capture JPEG base64 de la vue courante (analyse vision). */
  const takeScreenshot = useCallback(async (): Promise<string | null> => {
    const sdk = sdkRef.current;
    if (!sdk?.Renderer?.takeScreenShot) return null;
    try {
      return await sdk.Renderer.takeScreenShot(
        { width: 1024, height: 576 },
        { mattertags: false, sweeps: false }
      );
    } catch {
      return null;
    }
  }, []);

  /** Cartographie complète du modèle (pour la synchronisation initiale en back-office). */
  const collectModelMap = useCallback(() => {
    const sweeps = Array.from(sweepsRef.current.entries()).map(([sid, s]) => ({
      sid,
      position: s.position,
      floor: s.floorInfo?.sequence ?? 0,
    }));
    const sdkRooms = Array.from(sdkRoomsRef.current.values()).map((r) => ({
      id: r.id,
      center: r.bounds
        ? {
            x: (r.bounds.min.x + r.bounds.max.x) / 2,
            y: (r.bounds.min.y + r.bounds.max.y) / 2,
            z: (r.bounds.min.z + r.bounds.max.z) / 2,
          }
        : null,
    }));
    return { sweeps, sdkRooms };
  }, []);

  const iframeSrc =
    `https://my.matterport.com/show/?m=${modelId}` +
    `&play=1&qs=1&log=0&title=0&brand=0&help=0&mls=0&vr=0` +
    `&applicationKey=${process.env.NEXT_PUBLIC_MATTERPORT_SDK_KEY ?? ''}`;

  return {
    iframeRef,
    iframeSrc,
    connect,
    state,
    moveToRoom,
    moveToSweep,
    setRotation,
    takeScreenshot,
    collectModelMap,
    getCurrentSweep: () => state.currentSweepId,
  };
}
