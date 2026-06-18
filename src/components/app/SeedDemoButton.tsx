'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Charge le bien de démonstration (Montreuil) via la fonction SQL seed_demo_property. */
export function SeedDemoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          const res = await fetch('/api/properties/seed-demo', { method: 'POST' });
          if (!res.ok) {
            setError((await res.json()).error ?? 'Erreur');
            setLoading(false);
            return;
          }
          router.refresh();
        }}
        className="rounded-xl border border-brass px-4 py-2 text-sm font-medium text-brass-deep transition hover:bg-brass/10 disabled:opacity-50"
      >
        {loading ? 'Chargement…' : 'Charger le bien de démo'}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
