import { createAdminClient } from '@/lib/supabase/admin';
import { chunkText } from '@/lib/rag/chunker';
import { embedBatch } from '@/lib/ai/embeddings';
import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Pipeline d'ingestion d'un document PDF :
 * storage → extraction texte → chunking → embeddings → pgvector.
 * Appelé de façon synchrone par /api/documents/upload (maxDuration: 120s).
 */
export async function ingestDocument(documentId: string) {
  const supabase = createAdminClient();

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();
  if (error || !doc) throw new Error('Document introuvable');

  try {
    // 1) Téléchargement depuis le storage
    const { data: file, error: dlError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);
    if (dlError || !file) throw new Error('Téléchargement impossible: ' + dlError?.message);

    // 2) Extraction du texte (unpdf : sans dépendance native, compatible serverless)
    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });

    const fullText = (Array.isArray(text) ? text.join('\n') : text) ?? '';
    if (fullText.trim().length < 30) {
      throw new Error(
        'Aucun texte extractible (PDF scanné ? Ajoutez une couche OCR avant import).'
      );
    }

    // 3) Chunking avec en-tête de contexte (améliore le retrieval)
    const header = `[Document: ${doc.name} | Type: ${doc.type}]`;
    const chunks = chunkText(fullText).map((c) => `${header}\n${c}`);

    // 4) Embeddings
    const embeddings = await embedBatch(chunks);

    // 5) Remplacement atomique des chunks
    await supabase.from('document_chunks').delete().eq('document_id', doc.id);
    const rows = chunks.map((content, i) => ({
      document_id: doc.id,
      property_id: doc.property_id,
      chunk_index: i,
      content,
      embedding: embeddings[i],
      metadata: { document_name: doc.name, document_type: doc.type },
    }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error: insErr } = await supabase
        .from('document_chunks')
        .insert(rows.slice(i, i + 100));
      if (insErr) throw new Error('Insertion chunks: ' + insErr.message);
    }

    await supabase
      .from('documents')
      .update({ status: 'ready', pages: totalPages, chunk_count: chunks.length, error: null })
      .eq('id', doc.id);

    return { chunks: chunks.length, pages: totalPages };
  } catch (e) {
    await supabase
      .from('documents')
      .update({ status: 'error', error: e instanceof Error ? e.message : 'Erreur inconnue' })
      .eq('id', doc.id);
    throw e;
  }
}
