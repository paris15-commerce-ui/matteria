'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Property, PropertyDocument, PropertyRoom } from '@/lib/types';
import { DOCUMENT_TYPES } from '@/lib/types';
import { useMatterport } from '@/hooks/useMatterport';
import { cn, formatPrice, getBaseUrl } from '@/lib/utils';

const TABS = [
  { id: 'apercu', label: 'Aperçu' },
  { id: 'pieces', label: 'Pièces & parcours' },
  { id: 'documents', label: 'Documents' },
  { id: 'ia', label: 'Agent IA' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const FIELD =
  'w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm focus:border-brass-deep focus:outline-none';

export function PropertyWorkspace({
  property: initialProperty,
  initialRooms,
  initialDocuments,
}: {
  property: Property;
  initialRooms: PropertyRoom[];
  initialDocuments: PropertyDocument[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('apercu');
  const [property, setProperty] = useState(initialProperty);
  const [rooms, setRooms] = useState(initialRooms);
  const [documents, setDocuments] = useState(initialDocuments);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const patchProperty = async (patch: Record<string, unknown>, msg = 'Enregistré') => {
    setBusy(true);
    const res = await fetch(`/api/properties/${property.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (!res.ok) return flash('Erreur lors de l’enregistrement');
    setProperty((p) => ({ ...p, ...patch } as Property));
    flash(msg);
  };

  // ----------------------------------------------------------------
  // Matterport (onglet pièces) — monté à la demande
  // ----------------------------------------------------------------
  const lastPositionRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const mp = useMatterport({
    modelId: property.matterport_model_id,
    rooms,
    onSweepChange: (_sweepId, position) => {
      lastPositionRef.current = position;
    },
  });
  const [sdkStarted, setSdkStarted] = useState(false);
  const openPiecesTab = () => {
    setTab('pieces');
    if (!sdkStarted) {
      setSdkStarted(true);
      window.setTimeout(() => void mp.connect(), 400); // laisse l'iframe se monter
    }
  };

  const visitUrl = `${getBaseUrl()}/visit/${property.id}`;

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{property.title}</h1>
          <p className="mt-1 text-stone-mute">
            {[property.city, property.surface && `${property.surface} m²`, formatPrice(property.price)]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href={visitUrl} target="_blank" rel="noreferrer"
            className="rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-medium transition hover:border-ink">
            Prévisualiser ↗
          </a>
          <button
            disabled={busy}
            onClick={() => patchProperty({ is_published: !property.is_published },
              property.is_published ? 'Bien dépublié' : 'Bien publié — lien actif')}
            className={cn('rounded-xl px-4 py-2.5 text-sm font-medium transition',
              property.is_published
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-ink text-porcelain hover:bg-ink-700')}
          >
            {property.is_published ? 'Publié ✓' : 'Publier'}
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="mt-8 flex gap-1 border-b border-ink/10">
        {TABS.map((t) => (
          <button key={t.id}
            onClick={() => (t.id === 'pieces' ? openPiecesTab() : setTab(t.id))}
            className={cn('rounded-t-xl px-4 py-2.5 text-sm transition',
              tab === t.id ? 'border border-b-0 border-ink/10 bg-white font-medium' : 'text-stone-mute hover:text-ink')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-b-2xl rounded-tr-2xl border border-t-0 border-ink/10 bg-white p-6">
        {tab === 'apercu' && (
          <OverviewTab property={property} visitUrl={visitUrl} onSave={patchProperty} busy={busy} flash={flash} />
        )}
        {tab === 'pieces' && (
          <RoomsTab
            property={property}
            rooms={rooms}
            setRooms={setRooms}
            mp={mp}
            lastPositionRef={lastPositionRef}
            flash={flash}
            onSaved={() => router.refresh()}
          />
        )}
        {tab === 'documents' && (
          <DocumentsTab propertyId={property.id} documents={documents} setDocuments={setDocuments} flash={flash} />
        )}
        {tab === 'ia' && <AiTab property={property} onSave={patchProperty} busy={busy} />}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm text-porcelain shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Onglet Aperçu — infos d'annonce + liens de partage + groupe
================================================================ */
function OverviewTab({
  property, visitUrl, onSave, busy, flash,
}: {
  property: Property;
  visitUrl: string;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  busy: boolean;
  flash: (m: string) => void;
}) {
  const [form, setForm] = useState({
    title: property.title,
    address: property.address ?? '',
    city: property.city ?? '',
    postal_code: property.postal_code ?? '',
    price: property.price?.toString() ?? '',
    surface: property.surface?.toString() ?? '',
    rooms_count: property.rooms_count?.toString() ?? '',
    description: property.description ?? '',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const [group, setGroup] = useState<{ code: string; hostKey: string } | null>(null);

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    flash(`${label} copié`);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <h3 className="font-display text-lg">Annonce</h3>
        <input className={FIELD} value={form.title} onChange={set('title')} placeholder="Titre" />
        <div className="grid grid-cols-2 gap-4">
          <input className={FIELD} value={form.address} onChange={set('address')} placeholder="Adresse" />
          <input className={FIELD} value={form.city} onChange={set('city')} placeholder="Ville" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <input className={FIELD} value={form.postal_code} onChange={set('postal_code')} placeholder="Code postal" />
          <input className={FIELD} value={form.price} onChange={set('price')} placeholder="Prix (€)" inputMode="numeric" />
          <input className={FIELD} value={form.surface} onChange={set('surface')} placeholder="Surface (m²)" inputMode="numeric" />
        </div>
        <textarea className={`${FIELD} min-h-36`} value={form.description} onChange={set('description')}
          placeholder="Description (l'IA s'en sert pour présenter le bien)" />
        <button
          disabled={busy}
          onClick={() => onSave({
            title: form.title,
            address: form.address || null,
            city: form.city || null,
            postal_code: form.postal_code || null,
            price: form.price ? Number(form.price) : null,
            surface: form.surface ? Number(form.surface) : null,
            rooms_count: form.rooms_count ? Number(form.rooms_count) : null,
            description: form.description || null,
          })}
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-porcelain transition hover:bg-ink-700 disabled:opacity-50">
          Enregistrer
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="font-display text-lg">Lien de visite</h3>
          <p className="mt-1 text-sm text-stone-mute">À partager dans vos annonces, emails et SMS.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-porcelain px-3 py-2.5 font-mono text-xs">{visitUrl}</code>
            <button onClick={() => copy(visitUrl, 'Lien')}
              className="shrink-0 rounded-xl border border-ink/15 px-3 py-2.5 text-sm transition hover:border-ink">
              Copier
            </button>
          </div>
          {!property.is_published && (
            <p className="mt-2 text-xs text-amber-700">Le bien n'est pas publié : le lien est inactif.</p>
          )}
        </div>

        <div>
          <h3 className="font-display text-lg">Visite de groupe</h3>
          <p className="mt-1 text-sm text-stone-mute">
            Visite synchronisée : vous pilotez, vos invités suivent votre caméra en direct (mode visio).
          </p>
          {!group ? (
            <button
              onClick={async () => {
                const res = await fetch('/api/group', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ propertyId: property.id }),
                });
                if (res.ok) setGroup(await res.json());
                else flash('Création impossible');
              }}
              className="mt-3 rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-medium transition hover:border-ink">
              Créer une session de groupe
            </button>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-mono text-lg tracking-[0.3em] text-brass-deep">{group.code}</p>
              <button onClick={() => copy(`${visitUrl}/group/${group.code}?host=${group.hostKey}`, 'Lien pilote')}
                className="block w-full rounded-xl bg-ink px-3 py-2.5 text-left text-porcelain transition hover:bg-ink-700">
                Copier mon lien <span className="opacity-70">(pilote + IA)</span>
              </button>
              <button onClick={() => copy(`${visitUrl}/group/${group.code}`, 'Lien invités')}
                className="block w-full rounded-xl border border-ink/15 px-3 py-2.5 text-left transition hover:border-ink">
                Copier le lien des invités
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Onglet Pièces & parcours — mapping Matterport + talking points
================================================================ */
function RoomsTab({
  property, rooms, setRooms, mp, lastPositionRef, flash, onSaved,
}: {
  property: Property;
  rooms: PropertyRoom[];
  setRooms: React.Dispatch<React.SetStateAction<PropertyRoom[]>>;
  mp: ReturnType<typeof useMatterport>;
  lastPositionRef: React.MutableRefObject<{ x: number; y: number; z: number } | null>;
  flash: (m: string) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const update = (id: string, patch: Partial<PropertyRoom>) =>
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const move = (index: number, dir: -1 | 1) =>
    setRooms((rs) => {
      const next = [...rs];
      const j = index + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[index], next[j]] = [next[j], next[index]];
      return next.map((r, i) => ({ ...r, tour_order: i }));
    });

  const addRoom = () =>
    setRooms((rs) => [
      ...rs,
      {
        id: `new-${crypto.randomUUID()}`,
        property_id: property.id,
        label: `Pièce ${rs.length + 1}`,
        matterport_room_id: null,
        sweep_ids: [],
        position: null,
        talking_points: [],
        tour_order: rs.length,
        include_in_tour: true,
      },
    ]);

  const placeHere = (room: PropertyRoom) => {
    const sweepId = mp.getCurrentSweep();
    const position = lastPositionRef.current;
    if (!sweepId) return flash('Déplacez-vous d’abord dans la visite ci-contre');
    update(room.id, {
      position: position ?? room.position,
      sweep_ids: Array.from(new Set([...(room.sweep_ids ?? []), sweepId])),
    });
    flash(`« ${room.label} » positionnée ici`);
  };

  const save = async () => {
    setSaving(true);
    // Les pièces avec id temporaire (new-…) partent en création, les autres en mise à jour
    const newOnes = rooms.filter((r) => r.id.startsWith('new-'));
    const res = await fetch(`/api/properties/${property.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rooms: rooms.filter((r) => !r.id.startsWith('new-')),
        new_rooms: newOnes.map(({ id: _id, ...rest }) => rest),
      }),
    });
    setSaving(false);
    if (!res.ok) return flash('Erreur lors de l’enregistrement');
    flash('Parcours enregistré');
    onSaved();
  };

  const sync = async () => {
    if (mp.state.status !== 'ready') return flash('La visite 3D n’est pas encore prête');
    setSyncing(true);
    const map = await mp.collectModelMap();
    const res = await fetch(`/api/properties/${property.id}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(map),
    });
    setSyncing(false);
    const json = await res.json();
    if (!res.ok) return flash(json.error ?? 'Synchronisation impossible');
    flash(json.hint ?? `Synchronisé : ${json.roomsMapped} pièce(s) reliée(s), ${json.sweeps} points de vue`);
    onSaved();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      {/* Visite embarquée */}
      <div>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-ink">
          <iframe ref={mp.iframeRef} src={mp.iframeSrc} title="Visite 3D"
            className="absolute inset-0 h-full w-full border-0" allow="xr-spatial-tracking; fullscreen" />
          {mp.state.status !== 'ready' && (
            <div className="absolute inset-0 grid place-items-center text-sm text-porcelain/70">
              {mp.state.status === 'error' ? `SDK : ${mp.state.error}` : 'Chargement de la visite…'}
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={sync} disabled={syncing}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-porcelain transition hover:bg-ink-700 disabled:opacity-50">
            {syncing ? 'Synchronisation…' : 'Synchroniser le modèle 3D'}
          </button>
          <p className="text-xs text-stone-mute">
            Pièce détectée : <span className="font-medium text-ink">{mp.state.currentRoomLabel ?? '—'}</span>
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-stone-mute">
          Méthode : déplacez-vous dans chaque pièce ci-dessus, cliquez « Se placer ici » sur la pièce
          correspondante, puis « Synchroniser » pour relier automatiquement tous les points de vue.
        </p>
      </div>

      {/* Éditeur de pièces */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">Parcours de visite guidée</h3>
          <button onClick={addRoom} className="text-sm text-brass-deep hover:underline">+ Ajouter une pièce</button>
        </div>
        <div className="thin-scroll mt-3 max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {rooms.map((room, i) => (
            <div key={room.id} className="rounded-2xl border border-ink/10 p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-stone-mute">{i + 1}</span>
                <input className="min-w-0 flex-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-sm font-medium focus:border-brass-deep focus:outline-none"
                  value={room.label} onChange={(e) => update(room.id, { label: e.target.value })} />
                <button onClick={() => move(i, -1)} className="rounded px-1.5 text-stone-mute hover:text-ink" aria-label="Monter">↑</button>
                <button onClick={() => move(i, 1)} className="rounded px-1.5 text-stone-mute hover:text-ink" aria-label="Descendre">↓</button>
              </div>
              <textarea
                className="mt-2 w-full rounded-lg border border-ink/10 px-2.5 py-2 text-sm focus:border-brass-deep focus:outline-none"
                rows={2}
                placeholder="Points forts (un par ligne) — l'IA s'en sert pour commenter"
                value={room.talking_points.join('\n')}
                onChange={(e) => update(room.id, { talking_points: e.target.value.split('\n').filter(Boolean) })}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <label className="flex items-center gap-1.5 text-stone-ink">
                  <input type="checkbox" checked={room.include_in_tour}
                    onChange={(e) => update(room.id, { include_in_tour: e.target.checked })} />
                  Dans la visite guidée
                </label>
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5',
                    (room.sweep_ids?.length ?? 0) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                    {(room.sweep_ids?.length ?? 0) > 0 ? `${room.sweep_ids.length} pt(s) de vue` : 'non reliée'}
                  </span>
                  <button onClick={() => placeHere(room)}
                    className="rounded-lg border border-ink/15 px-2.5 py-1 transition hover:border-brass-deep hover:text-brass-deep">
                    Se placer ici
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={save} disabled={saving}
          className="mt-4 rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-porcelain transition hover:bg-ink-700 disabled:opacity-50">
          {saving ? 'Enregistrement…' : 'Enregistrer le parcours'}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   Onglet Documents — import PDF -> base de connaissance (RAG)
================================================================ */
function DocumentsTab({
  propertyId, documents, setDocuments, flash,
}: {
  propertyId: string;
  documents: PropertyDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<PropertyDocument[]>>;
  flash: (m: string) => void;
}) {
  const [type, setType] = useState('annonce');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.set('file', file);
    form.set('propertyId', propertyId);
    form.set('type', type);
    const res = await fetch('/api/documents/upload', { method: 'POST', body: form });
    setUploading(false);
    const json = await res.json();
    if (!res.ok) return flash(json.error ?? 'Import impossible');
    setDocuments((d) => [
      {
        id: json.id,
        property_id: propertyId,
        name: file.name,
        type,
        status: json.status,
        pages: json.pages ?? null,
        chunk_count: json.chunks ?? null,
        error: null,
        created_at: new Date().toISOString(),
      } as PropertyDocument,
      ...d,
    ]);
    flash(json.status === 'ready'
      ? `Document indexé (${json.chunks} passages) — l'IA peut maintenant répondre dessus`
      : 'Import effectué, indexation en erreur (PDF scanné ?)');
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) return flash('Suppression impossible');
    setDocuments((d) => d.filter((x) => x.id !== id));
  };

  return (
    <div className="max-w-3xl">
      <h3 className="font-display text-lg">Base de connaissance du bien</h3>
      <p className="mt-1 text-sm leading-relaxed text-stone-mute">
        Importez les PDF officiels : DPE, diagnostics, PV d'assemblée générale, règlement de copropriété,
        taxe foncière, annonce, mandat. <strong className="text-ink">L'IA ne répond aux questions factuelles
        que sur la base de ces documents</strong> — sans document, elle dit qu'elle transmettra à l'agence.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${FIELD} w-auto`}>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-porcelain transition hover:bg-ink-700 disabled:opacity-50">
          {uploading ? 'Indexation en cours…' : 'Importer un PDF'}
        </button>
      </div>

      <ul className="mt-6 divide-y divide-ink/5 rounded-2xl border border-ink/10">
        {documents.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className={cn('h-2 w-2 shrink-0 rounded-full',
              d.status === 'ready' ? 'bg-emerald-500' : d.status === 'processing' ? 'bg-amber-400' : 'bg-red-500')} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{d.name}</p>
              <p className="text-xs text-stone-mute">
                {DOCUMENT_TYPES.find((t) => t.value === d.type)?.label ?? d.type}
                {d.chunk_count ? ` · ${d.chunk_count} passages indexés` : ''}
                {d.status === 'error' && ' · échec d’indexation'}
              </p>
            </div>
            <button onClick={() => remove(d.id)} className="text-xs text-stone-mute hover:text-red-600">Supprimer</button>
          </li>
        ))}
        {documents.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-stone-mute">Aucun document pour l'instant.</li>
        )}
      </ul>
    </div>
  );
}

/* ================================================================
   Onglet Agent IA — persona, points forts, faits structurés
================================================================ */
function AiTab({
  property, onSave, busy,
}: {
  property: Property;
  onSave: (patch: Record<string, unknown>, msg?: string) => Promise<void>;
  busy: boolean;
}) {
  const [agentName, setAgentName] = useState(property.agent_name);
  const [highlights, setHighlights] = useState((property.highlights ?? []).join('\n'));
  const initialFacts = useMemo(
    () => Object.entries(property.facts ?? {}).map(([k, v]) => ({ k, v: String(v) })),
    [property.facts],
  );
  const [facts, setFacts] = useState<{ k: string; v: string }[]>(
    initialFacts.length ? initialFacts : [{ k: '', v: '' }],
  );

  const setFact = (i: number, field: 'k' | 'v', value: string) =>
    setFacts((fs) => fs.map((f, j) => (j === i ? { ...f, [field]: value } : f)));

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h3 className="font-display text-lg">Persona</h3>
        <p className="mt-1 text-sm text-stone-mute">Le prénom sous lequel l'agent IA se présente aux visiteurs.</p>
        <input className={`${FIELD} mt-3 max-w-xs`} value={agentName} onChange={(e) => setAgentName(e.target.value)} />
      </div>

      <div>
        <h3 className="font-display text-lg">Points forts du bien</h3>
        <p className="mt-1 text-sm text-stone-mute">Un par ligne — l'IA les met en avant naturellement.</p>
        <textarea className={`${FIELD} mt-3 min-h-28`} value={highlights} onChange={(e) => setHighlights(e.target.value)}
          placeholder={'Jardin de 80 m² exposé sud\nMétro à 4 minutes à pied\nAucun travaux à prévoir'} />
      </div>

      <div>
        <h3 className="font-display text-lg">Faits structurés</h3>
        <p className="mt-1 text-sm text-stone-mute">
          Informations sûres que l'IA peut citer directement (charges, taxe foncière, étage, chauffage, DPE…).
        </p>
        <div className="mt-3 space-y-2">
          {facts.map((f, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${FIELD} w-1/3`} placeholder="Clé (ex : Taxe foncière)" value={f.k}
                onChange={(e) => setFact(i, 'k', e.target.value)} />
              <input className={FIELD} placeholder="Valeur (ex : 1 250 € / an)" value={f.v}
                onChange={(e) => setFact(i, 'v', e.target.value)} />
              <button onClick={() => setFacts((fs) => fs.filter((_, j) => j !== i))}
                className="px-2 text-stone-mute hover:text-red-600" aria-label="Supprimer">×</button>
            </div>
          ))}
          <button onClick={() => setFacts((fs) => [...fs, { k: '', v: '' }])}
            className="text-sm text-brass-deep hover:underline">+ Ajouter un fait</button>
        </div>
      </div>

      <button
        disabled={busy}
        onClick={() => onSave({
          agent_name: agentName || 'Claire',
          highlights: highlights.split('\n').map((s) => s.trim()).filter(Boolean),
          facts: Object.fromEntries(facts.filter((f) => f.k.trim()).map((f) => [f.k.trim(), f.v.trim()])),
        }, "Réglages de l'agent enregistrés")}
        className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-porcelain transition hover:bg-ink-700 disabled:opacity-50">
        Enregistrer
      </button>
    </div>
  );
}
