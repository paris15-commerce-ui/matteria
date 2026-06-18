import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Liste des leads de l'organisation (RLS). */
export async function GET(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const stage = req.nextUrl.searchParams.get('stage');
  let query = ctx.supabase
    .from('leads')
    .select('*, properties(title)')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (stage) query = query.eq('stage', stage);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data });
}

/** Création manuelle d'un lead. */
export async function POST(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const { data, error } = await ctx.supabase
    .from('leads')
    .insert({
      organization_id: ctx.profile.organization_id,
      property_id: body.property_id ?? null,
      full_name: body.full_name ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      stage: body.stage ?? 'prospect',
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}
