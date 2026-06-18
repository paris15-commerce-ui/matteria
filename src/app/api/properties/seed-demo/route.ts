import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** Insère le bien de démonstration (fonction SQL seed_demo_property du seed). */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('seed_demo_property', {
    p_org: ctx.profile.organization_id,
  });
  if (error) {
    return NextResponse.json(
      { error: 'Fonction de démo absente — exécutez supabase/seed.sql.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ propertyId: data });
}
