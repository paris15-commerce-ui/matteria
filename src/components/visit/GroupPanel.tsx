'use client';

import type { GroupParticipant } from '@/hooks/useGroupSync';

/** Panneau latéral de visite de groupe : code de session + participants en direct. */
export function GroupPanel({
  code,
  participants,
}: {
  code: string;
  participants: GroupParticipant[];
}) {
  return (
    <div className="absolute right-3 top-3 z-20 w-56 rounded-2xl border border-porcelain/10 bg-ink/75 p-3 text-porcelain backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/50">Groupe</p>
        <span className="rounded-md bg-brass/15 px-2 py-0.5 font-mono text-xs tracking-widest text-brass">{code}</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {participants.map((p) => (
          <li key={p.key} className="flex items-center gap-2 text-sm">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.role === 'host' ? 'bg-brass' : 'bg-emerald-400'}`} />
            <span className="truncate">{p.name || 'Invité'}</span>
            {p.role === 'host' && <span className="text-[10px] text-brass">guide</span>}
            {p.roomLabel && <span className="ml-auto truncate text-[10px] text-porcelain/45">{p.roomLabel}</span>}
          </li>
        ))}
        {participants.length === 0 && (
          <li className="text-xs text-porcelain/45">En attente de participants…</li>
        )}
      </ul>
    </div>
  );
}
