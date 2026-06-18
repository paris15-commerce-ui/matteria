import type { Qualification, TranscriptEntry } from '@/lib/types';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

export interface ExtractedQualification extends Qualification {
  contact?: { full_name?: string; email?: string; phone?: string };
  suggested_next_step?: string;
}

/**
 * Post-visite : extraction structurée de la qualification à partir du transcript.
 * Utilise Groq (gratuit) à la place d'OpenAI.
 */
export async function extractQualification(
  transcript: TranscriptEntry[]
): Promise<ExtractedQualification> {
  if (!transcript.length) return {};
  if (!process.env.GROQ_API_KEY) {
    console.warn('[qualification] GROQ_API_KEY absent');
    return {};
  }

  const dialogue = transcript
    .map((t) => `${t.role === 'user' ? 'VISITEUR' : 'AGENT'}: ${t.text}`)
    .join('\n')
    .slice(0, 24000);

  try {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: [
              'Tu es un directeur agence immobilière qui débriefe une visite.',
              'Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.',
              'Format attendu (remplis uniquement ce qui est explicitement dit, null sinon) :',
              '{"interest_level":50,"budget":null,"financing":null,"timeline":null,',
              '"purpose":null,"objections":[],"summary":"","contact":',
              '{"full_name":null,"email":null,"phone":null},"suggested_next_step":""}',
            ].join(' '),
          },
          { role: 'user', content: dialogue },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text) as ExtractedQualification;
  } catch (e) {
    console.error('[qualification] extractQualification error', e);
    return {};
  }
}
