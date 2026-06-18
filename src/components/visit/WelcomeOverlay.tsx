'use client';

import { useState } from 'react';
import type { Property } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import type { VisitMode } from '@/lib/types';

/**
 * Écran d'accueil de la visite : choix visite libre / guidée, prénom
 * facultatif, et déclenchement du micro (geste utilisateur requis pour
 * getUserMedia + lecture audio).
 */
export function WelcomeOverlay({
  property,
  groupMode,
  onStart,
}: {
  property: Property;
  groupMode?: boolean;
  onStart: (mode: VisitMode, visitorLabel: string) => void;
}) {
  const [name, setName] = useState('');
  const [starting, setStarting] = useState<VisitMode | null>(null);

  const start = (mode: VisitMode) => {
    if (starting) return;
    setStarting(mode);
    onStart(mode, name.trim());
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-ink/80 backdrop-blur-md">
      <div className="mx-4 w-full max-w-md animate-fade-up rounded-3xl border border-porcelain/10 bg-ink-800/90 p-8 text-center shadow-2xl">
        <div className="halo mx-auto mb-6 h-16 w-16" data-state="speaking">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brass text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
          </div>
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">
          Visite augmentée par {property.agent_name}
        </p>
        <h1 className="mt-2 font-display text-2xl text-porcelain">{property.title}</h1>
        <p className="mt-1 text-sm text-porcelain/60">
          {[property.city, property.surface && `${property.surface} m²`, formatPrice(property.price)]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Votre prénom (facultatif)"
          maxLength={40}
          className="mt-6 w-full rounded-xl border border-porcelain/15 bg-ink px-4 py-3 text-center text-porcelain placeholder:text-porcelain/35 focus:border-brass focus:outline-none"
        />

        {groupMode ? (
          <button
            onClick={() => start('groupe')}
            disabled={!!starting}
            className="mt-4 w-full rounded-xl bg-brass px-4 py-3.5 font-medium text-ink transition hover:bg-brass-soft disabled:opacity-60"
          >
            {starting ? 'Connexion…' : 'Rejoindre la visite de groupe'}
          </button>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => start('guidee')}
              disabled={!!starting}
              className="rounded-xl bg-brass px-4 py-3.5 font-medium text-ink transition hover:bg-brass-soft disabled:opacity-60"
            >
              {starting === 'guidee' ? 'Connexion…' : 'Visite guidée'}
            </button>
            <button
              onClick={() => start('libre')}
              disabled={!!starting}
              className="rounded-xl border border-porcelain/20 px-4 py-3.5 font-medium text-porcelain transition hover:border-brass hover:text-brass disabled:opacity-60"
            >
              {starting === 'libre' ? 'Connexion…' : 'Visite libre'}
            </button>
          </div>
        )}

        <p className="mt-5 text-xs leading-relaxed text-porcelain/45">
          Le micro s'active pour dialoguer à la voix avec {property.agent_name}.
          Vous pouvez le couper à tout moment.
        </p>
      </div>
    </div>
  );
}
