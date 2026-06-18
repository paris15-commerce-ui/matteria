import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionContext } from '@/lib/supabase/server';
import { ingestDocument } from '@/lib/rag/ingest';

export const runtime = 'nodejs';
export const maxDuration = 120; // ingestion PDF + embeddings inline

const MAX_SIZE = 25 * 1024 * 1024;

/**
 * Upload d'un document (PDF) attaché à un bien :
 * storage privé -> ligne `documents` -> ingestion RAG immédiate
 * (extraction texte, chunking, embeddings).
 */
export async function POST(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const propertyId = form.get('propertyId') as string | null;
  const type = (form.get('type') as string | null) ?? 'autre';

  if (!file || !propertyId) {
    return NextResponse.json({ error: 'file et propertyId requis' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'PDF uniquement' }, { status: 415 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Fichier > 25 Mo' }, { status: 413 });
  }

  const admin = createAdminClient();
  const orgId = ctx.profile.organization_id;

  const { data: property } = await admin
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('organization_id', orgId)
    .single();
  if (!property) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });

  const storagePath = `${orgId}/${propertyId}/${crypto.randomUUID()}.pdf`;
  const { error: upErr } = await admin.storage
    .from('documents')
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: 'application/pdf',
    });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: doc, error: insErr } = await admin
    .from('documents')
    .insert({
      organization_id: orgId,
      property_id: propertyId,
      name: file.name,
      type,
      storage_path: storagePath,
      size_bytes: file.size,
      status: 'processing',
    })
    .select()
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  try {
    const { chunks } = await ingestDocument(doc.id);
    return NextResponse.json({ id: doc.id, status: 'ready', chunks });
  } catch (e) {
    console.error('[documents/upload] ingestion', e);
    return NextResponse.json({ id: doc.id, status: 'error' }, { status: 200 });
  }
}
