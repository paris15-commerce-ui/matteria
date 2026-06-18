import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { VisitMode } from '@/lib/types';

export const runtime = 'nodejs';

/** Ouverture d'une visite anonyme sur un bien publié (page /visit/[id]). */
export async function POST(req: NextRequest) {
  try {
    const { propertyId, mode, visitorLabel, device, referrer } = (await req.json()) as {
      propertyId: string;
      mode?: VisitMode;
      visitorLabel?: string;
      device?: string;
      referrer?: string;
    };
    if (!propertyId) return NextResponse.json({ error: 'propertyId requis' }, { status: 400 });

    const admin = createAdminClient();
    const { data: property } = await admin
      .from('properties')
      .select('id, organization_id')
      .eq('id', propertyId)
      .eq('is_published', true)
      .single();
    if (!property) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });

    const { data: visit, error } = await admin
      .from('visits')
      .insert({
        organization_id: property.organization_id,
        property_id: propertyId,
        mode: mode ?? 'libre',
        visitor_label: visitorLabel?.slice(0, 60) || null,
        device: device?.slice(0, 120) || null,
        referrer: referrer?.slice(0, 300) || null,
      })
      .select('id')
      .single();
    if (error) throw error;

    return NextResponse.json({ visitId: visit.id });
  } catch (e) {
    console.error('[visits POST]', e);
    return NextResponse.json({ error: 'Création de visite impossible' }, { status: 500 });
  }
}
