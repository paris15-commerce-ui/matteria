import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeView } from '@/lib/ai/vision';

export const runtime = 'nodejs';

/** Analyse vision (gpt-4o-mini) d'un screenshot Matterport — tool de l'agent. */
export async function POST(req: NextRequest) {
  try {
    const { propertyId, image } = (await req.json()) as { propertyId: string; image: string };
    if (!propertyId || !image) {
      return NextResponse.json({ error: 'propertyId et image requis' }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: property } = await admin
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('is_published', true)
      .single();
    if (!property) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });

    const analysis = await analyzeView(image);
    return NextResponse.json(analysis);
  } catch (e) {
    console.error('[vision/analyze]', e);
    return NextResponse.json({ error: 'Analyse impossible' }, { status: 500 });
  }
}
