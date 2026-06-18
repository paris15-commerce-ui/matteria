'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LeadStage } from '@/lib/types';
import { LEAD_STAGES } from '@/lib/types';

/** Sélecteur d'étape du pipeline (fiche lead). */
export function LeadStageSelect({ leadId, stage }: { leadId: string; stage: LeadStage }) {
  const router = useRouter();
  const [value, setValue] = useState<LeadStage>(stage);

  return (
    <select
      value={value}
      onChange={async (e) => {
        const next = e.target.value as LeadStage;
        setValue(next);
        await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: next }),
        });
        router.refresh();
      }}
      className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm font-medium focus:border-brass-deep focus:outline-none"
    >
      {LEAD_STAGES.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}
