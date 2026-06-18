import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { embedText } from '@/lib/ai/embeddings';

export const runtime = 'nodejs';

/**
 * Recherche sémantique dans les documents du bien (tool de l'agent vocal).
 * Renvoie les passages les plus proches — l'agent ne répond que sur cette base.
 */
export async function POST(req: NextRequest) {
  try {
    const { propertyId, query, visitId } = (await req.json()) as {
      propertyId: string;
      query: string;
      visitId?: string | null;
    };
    if (!propertyId || !query) {
      return NextResponse.json({ error: 'propertyId et query requis' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: property } = await admin
      .from('properties')
      .select('id, organization_id, is_published')
      .eq('id', propertyId)
      .eq('is_published', true)
      .single();
    if (!property) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });

    const embedding = await embedText(query);
    const { data: chunks, error } = await admin.rpc('match_document_chunks', {
      p_property_id: propertyId,
      query_embedding: JSON.stringify(embedding),
      match_count: 5,
      min_similarity: 0.2,
    });
    if (error) throw error;

    // Journalise la question (FAQ analytics + suivi par bien)
    await admin.from('questions').insert({
      property_id: propertyId,
      visit_id: visitId ?? null,
      question: query.slice(0, 500),
    });

    const results = (chunks ?? []).map(
      (c: { content: string; document_name: string; similarity: number }) => ({
        source: c.document_name,
        similarity: Math.round(c.similarity * 100) / 100,
        passage: c.content,
      }),
    );

    return NextResponse.json({
      found: results.length > 0,
      results,
      note:
        results.length === 0
          ? "Aucun document ne contient cette information. Réponds : « Je n'ai pas cette information dans mon dossier, je transmets votre question à l'agence. »"
          : undefined,
    });
  } catch (e) {
    console.error('[rag/search]', e);
    return NextResponse.json({ error: 'Recherche impossible' }, { status: 500 });
  }
}
