import Link from 'next/link';
import { getSessionContext } from '@/lib/supabase/server';
import { formatDuration } from '@/lib/utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { SeedDemoButton } from '@/components/app/SeedDemoButton';

/** Tableau de bord : KPIs 30 jours + dernières visites + accès rapides. */
export default async function DashboardPage() {
  const ctx = (await getSessionContext())!;
  const orgId = ctx.profile.organization_id;
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [{ count: propertiesCount }, { data: visits }, { count: leadsCount }, { data: hotLeads }] =
    await Promise.all([
      ctx.supabase.from('properties').select('id', { count: 'exact', head: true }),
      admin
        .from('visits')
        .select('id, started_at, duration_seconds, engagement_score, mode, visitor_label, lead_id, properties(title)')
        .eq('organization_id', orgId)
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(8),
      ctx.supabase.from('leads').select('id', { count: 'exact', head: true }),
      ctx.supabase
        .from('leads')
        .select('id, full_name, score, stage, properties(title)')
        .in('stage', ['acquereur_chaud', 'offre'])
        .order('score', { ascending: false })
        .limit(5),
    ]);

  const all = visits ?? [];
  const ended = all.filter((v) => v.duration_seconds != null);
  const avgDuration = ended.length
    ? Math.round(ended.reduce((a, v) => a + (v.duration_seconds ?? 0), 0) / ended.length)
    : 0;
  const conversion = all.length
    ? Math.round((all.filter((v) => v.lead_id).length / all.length) * 100)
    : 0;

  const stats = [
    { label: 'Biens connectés', value: String(propertiesCount ?? 0) },
    { label: 'Visites (30 j)', value: String(all.length) },
    { label: 'Durée moyenne', value: formatDuration(avgDuration) },
    { label: 'Conversion lead', value: `${conversion}%` },
    { label: 'Leads au total', value: String(leadsCount ?? 0) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-stone-mute">{ctx.profile.organizations?.name}</p>
        </div>
        <Link href="/app/properties/new"
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-porcelain transition hover:bg-ink-700">
          + Connecter un bien
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="font-display text-3xl">{s.value}</p>
            <p className="mt-1 text-sm text-stone-mute">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <h2 className="font-display text-xl">Dernières visites</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10 bg-white">
            {all.length === 0 ? (
              <div className="p-8 text-center text-sm text-stone-mute">
                <p>Aucune visite pour le moment.</p>
                <p className="mt-2">Connectez un bien, publiez-le, partagez le lien — ou chargez le bien de démonstration :</p>
                <SeedDemoButton />
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {all.map((v) => (
                    <tr key={v.id} className="border-b border-ink/5 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{(v.properties as { title?: string } | null)?.title ?? 'Bien supprimé'}</p>
                        <p className="text-xs text-stone-mute">
                          {v.visitor_label || 'Visiteur'} · {v.mode}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-stone-ink">{formatDuration(v.duration_seconds)}</td>
                      <td className="px-4 py-3 text-right">
                        {v.engagement_score != null && (
                          <span className="rounded-full bg-porcelain px-2.5 py-1 font-mono text-xs">
                            {v.engagement_score}/100
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl">Acquéreurs chauds</h2>
          <div className="mt-4 space-y-3">
            {(hotLeads ?? []).map((l) => (
              <Link key={l.id} href={`/app/crm/${l.id}`}
                className="block rounded-2xl border border-ink/10 bg-white p-4 transition hover:border-brass">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{l.full_name ?? 'Prospect anonyme'}</p>
                  <span className="font-mono text-sm text-brass-deep">{l.score}/100</span>
                </div>
                <p className="mt-1 text-xs text-stone-mute">{(l.properties as { title?: string } | null)?.title}</p>
              </Link>
            ))}
            {(hotLeads ?? []).length === 0 && (
              <p className="rounded-2xl border border-ink/10 bg-white p-5 text-sm text-stone-mute">
                Les prospects les plus engagés apparaîtront ici, scorés par l'IA.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
