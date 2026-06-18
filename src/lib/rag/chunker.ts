/**
 * Découpage de texte pour le RAG.
 * Cibles : ~900 caractères par chunk, chevauchement 150, coupures sur
 * paragraphes puis phrases pour préserver le sens (DPE, PV d'AG, règlements…).
 */
export function chunkText(
  raw: string,
  opts: { size?: number; overlap?: number } = {}
): string[] {
  const size = opts.size ?? 900;
  const overlap = opts.overlap ?? 150;

  const text = raw
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return [];
  if (text.length <= size) return [text];

  // 1) paragraphes
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  const push = () => {
    const c = current.trim();
    if (c.length > 40) chunks.push(c);
    current = '';
  };

  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length <= size) {
      current = current ? current + '\n\n' + p : p;
      continue;
    }
    push();
    if (p.length <= size) {
      current = p;
      continue;
    }
    // 2) paragraphe trop long → phrases
    const sentences = p.split(/(?<=[.!?;])\s+/);
    for (const s of sentences) {
      if ((current + ' ' + s).length <= size) {
        current = current ? current + ' ' + s : s;
      } else {
        push();
        current = s.length > size ? s.slice(0, size) : s; // garde-fou
      }
    }
    push();
  }
  push();

  // 3) chevauchement (contexte glissant)
  if (overlap > 0 && chunks.length > 1) {
    return chunks.map((c, i) =>
      i === 0 ? c : chunks[i - 1].slice(-overlap) + ' … ' + c
    );
  }
  return chunks;
}
