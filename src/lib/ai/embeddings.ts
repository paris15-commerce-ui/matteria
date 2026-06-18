import OpenAI from 'openai';

// OpenAI optionnel — requis uniquement pour le RAG (recherche dans documents PDF).
// Sans OPENAI_API_KEY, la recherche documentaire est désactivée mais l'agent vocal fonctionne.
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims (= vector(1536) en base)

export async function embedText(text: string): Promise<number[]> {
  if (!openai) { console.warn('[embeddings] OPENAI_API_KEY absent — RAG désactivé'); return []; }
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  // FIX BUG 2 : vérification null manquante — crash runtime si OPENAI_API_KEY absent
  if (!openai) {
    console.warn('[embeddings] OPENAI_API_KEY absent — embedBatch désactivé');
    return texts.map(() => []);
  }
  const out: number[][] = [];
  // OpenAI accepte les batchs ; on segmente par 64 pour rester sous les limites
  for (let i = 0; i < texts.length; i += 64) {
    const slice = texts.slice(i, i + 64).map((t) => t.slice(0, 8000));
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: slice });
    res.data.sort((a, b) => a.index - b.index).forEach((d) => out.push(d.embedding));
  }
  return out;
}
