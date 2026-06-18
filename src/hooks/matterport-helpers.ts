'use client';

export type { MpSdk, SweepData, RoomData, Vector3 } from '@/lib/matterport/types';
import type { SweepData, Vector3 } from '@/lib/matterport/types';

/** Sous-ensemble de PropertyRoom nécessaire au viewer. */
export interface PropertyRoomLike {
  label: string;
  matterport_room_id: string | null;
  sweep_ids: string[];
  position: Vector3 | null;
  talking_points: string[];
  tour_order: number;
  include_in_tour: boolean;
}

const SHOWCASE_SCRIPT = 'https://static.matterport.com/showcase-sdk/latest.js';
let scriptPromise: Promise<void> | null = null;

/** Charge une seule fois le script Showcase SDK. */
export function loadShowcaseScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.MP_SDK) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SHOWCASE_SCRIPT;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Impossible de charger le SDK Matterport'));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export function distance2D(a: Vector3, b: Vector3) {
  // distance au sol (x,z) — l'axe y de Matterport est la hauteur
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function nearestSweep(
  sweeps: Map<string, SweepData>,
  target: Vector3
): string | null {
  let best: { sid: string; d: number } | null = null;
  for (const [sid, s] of sweeps) {
    if (!s.position) continue;
    const d = distance2D(s.position, target);
    if (!best || d < best.d) best = { sid, d };
  }
  return best?.sid ?? null;
}
