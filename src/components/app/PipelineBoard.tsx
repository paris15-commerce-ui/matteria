'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Lead, LeadStage } from '@/lib/types';
import { LEAD_STAGES } from '@/lib/types';
import { cn } from '@/lib/utils';

type BoardLead = Lead & { properties: { title: string } | null };

/** Kanban du pipeline commercial — drag & drop natif HTML5. */
export function PipelineBoard({ initialLeads }: { initialLeads: BoardLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);

  const moveTo = async (leadId: string, stage: LeadStage) => {
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    });
  };

  return (
    <div className="thin-scroll mt-8 flex gap-4 overflow-x-auto pb-4">
      {LEAD_STAGES.map((stage) => {
        const column = leads.filter((l) => l.stage === stage.value);
        return (
          <div
            key={stage.value}
            onDragOver={(e) => { e.preventDefault(); setOverStage(stage.value); }}
            onDragLeave={() => setOverStage((s) => (s === stage.value ? null : s))}
            onDrop={() => {
              if (dragId) void moveTo(dragId, stage.value);
              setDragId(null);
              setOverStage(null);
            }}
            className={cn(
              'flex w-64 shrink-0 flex-col rounded-2xl border bg-white/60 p-3 transition',
              overStage === stage.value ? 'border-brass bg-brass/5' : 'border-ink/10',
            )}
          >
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-medium">{stage.label}</p>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-xs">{column.length}</span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {column.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/app/crm/${lead.id}`}
                  draggable
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => setDragId(null)}
                  className={cn(
                    'cursor-grab rounded-xl border border-ink/10 bg-white p-3 transition hover:border-brass active:cursor-grabbing',
                    dragId === lead.id && 'opacity-50',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{lead.full_name ?? 'Prospect anonyme'}</p>
                    <span className="shrink-0 font-mono text-xs text-brass-deep">{lead.score}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-stone-mute">{lead.properties?.title ?? '—'}</p>
                  {(lead.qualification?.budget || lead.qualification?.timeline) && (
                    <p className="mt-1.5 truncate text-[11px] text-stone-ink">
                      {[lead.qualification?.budget, lead.qualification?.timeline].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </Link>
              ))}
              {column.length === 0 && (
                <p className="rounded-xl border border-dashed border-ink/15 p-3 text-center text-xs text-stone-mute">
                  Déposez ici
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
