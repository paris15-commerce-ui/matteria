import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Tableau de bord agence : KPIs sur 30 jours (filtrables par bien).
 * visites, durée moyenne, score moyen, conversion lead, pipeline,
 * pièces les plus regardées, questions fréquentes, série journalière.
 */
export async function GET(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const orgId = ctx.profile.organization_id;
  const propertyId = req.nextUrl.searchParams.get('propertyId');
  const days = Math.min(90, Number(req.nextUrl.searchParams.get('days') ?? 30));
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const admin = createAdminClient();

  let visitsQ = admin
    .from('visits')
    .select('id, started_at, duration_seconds, engagement_score, mode, lead_id')
    .eq('organization_id', orgId)
    .gte('started_at', since);
  if (propertyId) visitsQ = visitsQ.eq('property_id', propertyId);
  const { data: visits } = await visitsQ;

  let leadsQ = admin
    .from('leads')
    .select('id, stage, score, created_at')
    .eq('organization_id', orgId);
  if (propertyId) leadsQ = leadsQ.eq('property_id', propertyId);
  const { data: leads } = await leadsQ;

  const [{ data: rooms }, { data: questions }] = await Promise.all([
    admin.rpc('top_rooms', { p_org: orgId, p_days: days, p_property: propertyId }),
    admin.rpc('top_questions', { p_org: orgId, p_days: days, p_property: propertyId }),
  ]);

  const all = visits ?? [];
  const ended = all.filter((v) => v.duration_seconds != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  // Série journalière (visites / jour)
  const byDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10), 0);
  }
  for (const v of all) {
    const d = v.started_at.slice(0, 10);
    if (byDay.has(d)) byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }

  const stageCounts: Record<string, number> = {};
  for (const l of leads ?? []) stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1;

  return NextResponse.json({
    days,
    visits: {
      total: all.length,
      avgDurationSeconds: Math.round(avg(ended.map((v) => v.duration_seconds as number))),
      avgEngagement: Math.round(avg(ended.map((v) => v.engagement_score ?? 0))),
      withLead: all.filter((v) => v.lead_id).length,
      conversionRate: all.length
        ? Math.round((all.filter((v) => v.lead_id).length / all.length) * 100)
        : 0,
      series: [...byDay.entries()].map(([date, count]) => ({ date, count })),
    },
    leads: { total: leads?.length ?? 0, byStage: stageCounts },
    topRooms: rooms ?? [],
    topQuestions: questions ?? [],
  });
}
