import { getSessionContext } from '@/lib/supabase/server';
import { PipelineBoard } from '@/components/app/PipelineBoard';
import type { Lead } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** CRM : pipeline kanban visite -> vente, alimenté automatiquement par l'IA. */
export default async function CrmPage() {
  const ctx = (await getSessionContext())!;
  const { data: leads } = await ctx.supabase
    .from('leads')
    .select('*, properties(title)')
    .order('updated_at', { ascending: false })
    .limit(300);

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">CRM</h1>
      <p className="mt-1 text-stone-mute">
        Chaque visite qualifiée crée ou enrichit une fiche. Déplacez les prospects d'étape en étape.
      </p>
      <PipelineBoard initialLeads={(leads ?? []) as (Lead & { properties: { title: string } | null })[]} />
    </div>
  );
}
