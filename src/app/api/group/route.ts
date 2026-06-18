import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionContext } from '@/lib/supabase/server';
import { shortCode } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Création d'une session de groupe (visite synchronisée / mode visio).
 * L'agent connecté crée la session ; les invités rejoignent via le code.
 */
export async function POST(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { propertyId } = (await req.json()) as { propertyId: string };
  const admin = createAdminClient();

  const { data: property } = await admin
    .from('properties')
    .select('id, organization_id')
    .eq('id', propertyId)
    .eq('organization_id', ctx.profile.organization_id)
    .single();
  if (!property) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });

  const code = shortCode(6);
  const hostKey = crypto.randomUUID();
  const { data: session, error } = await admin
    .from('group_sessions')
    .insert({ property_id: propertyId, code, host_key: hostKey, created_by: ctx.user.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ code: session.code, hostKey, propertyId });
}

/** Vérifie un code de groupe (invités). */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code requis' }, { status: 400 });
  const admin = createAdminClient();
  const { data } = await admin
    .from('group_sessions')
    .select('code, property_id, is_active')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();
  if (!data) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
  return NextResponse.json(data);
}
