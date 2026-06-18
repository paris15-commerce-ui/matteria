import { getSessionContext } from '@/lib/supabase/server';
import { AnalyticsDashboard } from '@/components/app/AnalyticsDashboard';

export const dynamic = 'force-dynamic';

/** Analytics agence : comportement des visiteurs et performance commerciale. */
export default async function AnalyticsPage() {
  const ctx = (await getSessionContext())!;
  const { data: properties } = await ctx.supabase
    .from('properties')
    .select('id, title')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Analytics</h1>
      <p className="mt-1 text-stone-mute">
        Ce que vos visites virtuelles révèlent : engagement, pièces clés, questions récurrentes.
      </p>
      <AnalyticsDashboard properties={properties ?? []} />
    </div>
  );
}
