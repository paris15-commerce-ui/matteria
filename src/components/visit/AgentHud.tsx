'use client';

import type { AgentState } from '@/hooks/useRealtimeAgent';
import { cn } from '@/lib/utils';

const STATE_LABEL: Record<AgentState, string> = {
  off: 'Hors ligne',
  connecting: 'Connexion…',
  idle: 'À votre écoute',
  listening: 'Vous écoute',
  thinking: 'Réfléchit',
  speaking: 'Vous parle',
  error: 'Erreur audio',
};

/**
 * HUD de l'agent vocal : halo signature (réagit à l'état parle/écoute),
 * sous-titres temps réel, contrôles micro / fin de visite, badge guidée.
 */
export function AgentHud({
  agentName,
  state,
  caption,
  muted,
  tourBadge,
  onToggleMute,
  onSkip,
  onEnd,
}: {
  agentName: string;
  state: AgentState;
  caption: string;
  muted: boolean;
  tourBadge?: string | null;
  onToggleMute: () => void;
  onSkip?: () => void;
  onEnd: () => void;
}) {
  return (
    <>
      {/* Badge étape visite guidée */}
      {tourBadge && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-brass/40 bg-ink/70 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-brass backdrop-blur">
          {tourBadge}
        </div>
      )}

      {/* Barre agent */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-5 pt-16"
        style={{ background: 'linear-gradient(to top, rgba(11,14,20,.92), rgba(11,14,20,0))' }}>
        {caption && (
          <p className="max-w-2xl animate-fade-up text-center text-sm leading-relaxed text-porcelain/90 drop-shadow">
            {caption}
          </p>
        )}

        <div className="flex items-center gap-4">
          {/* Micro */}
          <button
            onClick={onToggleMute}
            aria-label={muted ? 'Réactiver le micro' : 'Couper le micro'}
            className={cn(
              'grid h-11 w-11 place-items-center rounded-full border transition',
              muted
                ? 'border-red-400/60 bg-red-500/15 text-red-300'
                : 'border-porcelain/20 bg-ink-800/80 text-porcelain hover:border-brass',
            )}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              {muted ? (
                <path d="m19.8 22.6-3-3A7 7 0 0 1 5 11h2a5 5 0 0 0 8.6 3.5l-1.5-1.4A3 3 0 0 1 9 11V8.4L1.4 1 2.8-.4l18.4 18.4-1.4 1.4ZM15 11c0 .3 0 .6-.1.8L9.2 6.1V6a3 3 0 1 1 6 0v5Zm-2 7.9V21h-2v-2.1c.3 0 .7.1 1 .1s.7 0 1-.1Z" />
              ) : (
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
              )}
            </svg>
          </button>

          {/* Halo central */}
          <div className="halo h-[72px] w-[72px]" data-state={state}>
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-b from-brass to-brass-deep text-ink shadow-lg">
              <span className="font-display text-lg">{agentName.charAt(0)}</span>
            </div>
          </div>

          {/* Suivant (guidée) ou fin */}
          {onSkip ? (
            <button
              onClick={onSkip}
              aria-label="Pièce suivante"
              className="grid h-11 w-11 place-items-center rounded-full border border-porcelain/20 bg-ink-800/80 text-porcelain transition hover:border-brass"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M6 18V6l8 6-8 6Zm10 0h2V6h-2v12Z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onEnd}
              aria-label="Terminer la visite"
              className="grid h-11 w-11 place-items-center rounded-full border border-porcelain/20 bg-ink-800/80 text-porcelain transition hover:border-red-400 hover:text-red-300"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M6 6h12v12H6z" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/50">
          <span className={cn('h-1.5 w-1.5 rounded-full',
            state === 'speaking' ? 'bg-brass' :
            state === 'listening' ? 'bg-emerald-400' :
            state === 'error' ? 'bg-red-400' : 'bg-porcelain/40')} />
          {agentName} · {STATE_LABEL[state]}
        </div>

        {onSkip && (
          <button onClick={onEnd} className="text-xs text-porcelain/40 underline-offset-2 hover:text-porcelain/70 hover:underline">
            Terminer la visite
          </button>
        )}
      </div>
    </>
  );
}
