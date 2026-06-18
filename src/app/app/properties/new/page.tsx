'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FIELD =
  'w-full rounded-xl border border-ink/15 bg-white px-4 py-3 focus:border-brass-deep focus:outline-none';

/** Connexion d'un nouveau bien : lien Matterport + infos d'annonce. */
export default function NewPropertyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '', matterport: '', address: '', city: '', postal_code: '',
    price: '', surface: '', rooms_count: '', description: '', agent_name: 'Claire',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  /** Accepte l'URL complète Matterport ou l'ID du modèle directement. */
  const extractModelId = (input: string) => {
    const m = input.match(/[?&]m=([A-Za-z0-9]+)/);
    return (m ? m[1] : input).trim();
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        matterport_model_id: extractModelId(form.matterport),
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        price: form.price ? Number(form.price) : null,
        surface: form.surface ? Number(form.surface) : null,
        rooms_count: form.rooms_count ? Number(form.rooms_count) : null,
        description: form.description || null,
        agent_name: form.agent_name || 'Claire',
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Erreur');
      setLoading(false);
      return;
    }
    router.replace(`/app/properties/${json.property.id}`);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl tracking-tight">Connecter un bien</h1>
      <p className="mt-2 text-stone-mute">
        Collez le lien de votre visite Matterport — tout le reste alimente l'agent IA.
      </p>

      <div className="mt-8 space-y-4">
        <input className={FIELD} placeholder="Lien ou ID Matterport (ex : https://my.matterport.com/show/?m=F38iQKKXgr5)"
          value={form.matterport} onChange={set('matterport')} />
        <input className={FIELD} placeholder="Titre de l'annonce *" value={form.title} onChange={set('title')} />
        <div className="grid grid-cols-2 gap-4">
          <input className={FIELD} placeholder="Adresse" value={form.address} onChange={set('address')} />
          <input className={FIELD} placeholder="Ville" value={form.city} onChange={set('city')} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <input className={FIELD} placeholder="Code postal" value={form.postal_code} onChange={set('postal_code')} />
          <input className={FIELD} placeholder="Prix (€)" inputMode="numeric" value={form.price} onChange={set('price')} />
          <input className={FIELD} placeholder="Surface (m²)" inputMode="numeric" value={form.surface} onChange={set('surface')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input className={FIELD} placeholder="Nombre de pièces" inputMode="numeric" value={form.rooms_count} onChange={set('rooms_count')} />
          <input className={FIELD} placeholder="Prénom de l'agent IA" value={form.agent_name} onChange={set('agent_name')} />
        </div>
        <textarea className={`${FIELD} min-h-32`} placeholder="Description de l'annonce (l'IA s'en sert pour présenter le bien)"
          value={form.description} onChange={set('description')} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={submit} disabled={loading || !form.title || !form.matterport}
          className="rounded-xl bg-ink px-6 py-3 font-medium text-porcelain transition hover:bg-ink-700 disabled:opacity-50">
          {loading ? 'Création…' : 'Créer le bien'}
        </button>
      </div>
    </div>
  );
}
