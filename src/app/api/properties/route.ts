import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/supabase/server';
import { PLAN_LIMITS } from '@/lib/types';
import type { PlanTier } from '@/lib/types';

export const runtime = 'nodejs';

const DEFAULT_ROOMS = [
  'Entrée', 'Séjour', 'Cuisine', 'Chambre 1', 'Chambre 2', 'Salle de bain',
];

/** Création d'un bien — contrôle du quota du plan en amont. */
export async function POST(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const orgId = ctx.profile.organization_id;

  const { data: sub } = await ctx.supabase
    .from('subscriptions')
    .select('plan, status, trial_end')
    .eq('organization_id', orgId)
    .single();

  const plan = (sub?.plan ?? 'trial') as PlanTier;
  const trialExpired =
    plan === 'trial' && sub?.trial_end && new Date(sub.trial_end) < new Date();
  if (trialExpired || sub?.status === 'canceled' || sub?.status === 'unpaid') {
    return NextResponse.json(
      { error: 'Abonnement requis — votre essai est terminé.', code: 'plan_required' },
      { status: 402 },
    );
  }

  const { count } = await ctx.supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);
  const limit = PLAN_LIMITS[plan].properties;
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Limite du plan atteinte (${limit} biens). Passez au plan supérieur.`, code: 'plan_limit' },
      { status: 402 },
    );
  }

  const body = await req.json();
  if (!body.title || !body.matterport_model_id) {
    return NextResponse.json({ error: 'title et matterport_model_id requis' }, { status: 400 });
  }

  const { data: property, error } = await ctx.supabase
    .from('properties')
    .insert({
      organization_id: orgId,
      title: String(body.title).slice(0, 200),
      address: body.address ?? null,
      city: body.city ?? null,
      postal_code: body.postal_code ?? null,
      price: body.price ?? null,
      surface: body.surface ?? null,
      rooms_count: body.rooms_count ?? null,
      description: body.description ?? null,
      matterport_model_id: String(body.matterport_model_id).trim(),
      agent_name: body.agent_name || 'Claire',
      facts: body.facts ?? {},
      highlights: body.highlights ?? [],
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pièces par défaut — affinées ensuite via la synchronisation Matterport
  await ctx.supabase.from('property_rooms').insert(
    DEFAULT_ROOMS.map((label, i) => ({
      property_id: property.id,
      label,
      tour_order: i,
      include_in_tour: true,
      talking_points: [],
      sweep_ids: [],
    })),
  );

  return NextResponse.json({ property });
}
