import Link from 'next/link';
import { getSessionContext } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';

/** Liste des biens connectés de l'organisation. */
export default async function PropertiesPage() {
  const ctx = (await getSessionContext())!;
  const { data: properties } = await ctx.supabase
    .from('properties')
    .select('id, title, city, price, surface, is_published, matterport_model_id, agent_name, created_at')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl tracking-tight">Biens</h1>
        <Link href="/app/properties/new"
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-porcelain transition hover:bg-ink-700">
          + Connecter un bien
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(properties ?? []).map((p) => (
          <Link key={p.id} href={`/app/properties/${p.id}`}
            className="group rounded-2xl border border-ink/10 bg-white p-5 transition hover:border-brass">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg leading-snug">{p.title}</h2>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                p.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-ink/5 text-stone-mute'
              }`}>
                {p.is_published ? 'Publié' : 'Brouillon'}
              </span>
            </div>
            <p className="mt-1 text-sm text-stone-mute">
              {[p.city, p.surface && `${p.surface} m²`, formatPrice(p.price)].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.15em] text-stone-mute">
              Agent IA : {p.agent_name} · {p.matterport_model_id}
            </p>
          </Link>
        ))}
        {(properties ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-sm text-stone-mute sm:col-span-2 lg:col-span-3">
            Aucun bien pour l'instant. Connectez votre première visite Matterport en 2 minutes.
          </div>
        )}
      </div>
    </div>
  );
}
