/**
 * analyzeView — analyse visuelle d'une capture Matterport.
 * Utilise meta-llama/llama-4-scout-17b-16e-instruct via Groq (modèle vision actuel).
 * (llama-3.2-11b-vision-preview a été décommissionné par Groq.)
 * Fallback : retourne analyse vide si GROQ_API_KEY absent.
 */
const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct';
export interface ViewAnalysis {
  room_type: string;
  features: string[];
  selling_points: string[];
}

export async function analyzeView(imageBase64: string): Promise<ViewAnalysis> {
  const fallback: ViewAnalysis = { room_type: 'inconnu', features: [], selling_points: [] };
  if (!process.env.GROQ_API_KEY) return fallback;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
              {
                type: 'text',
                text: `Analyse cette image d'une visite immobilière 3D. Réponds UNIQUEMENT en JSON valide avec ce format exact :
{"room_type":"<type de pièce en français>","features":["<équipement 1>","<équipement 2>"],"selling_points":["<point fort 1>","<point fort 2>"]}
Maximum 3 features et 2 selling_points. Sois concis.`,
              },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return fallback;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    return JSON.parse(match[0]) as ViewAnalysis;
  } catch (e) {
    console.warn('[vision] analyzeView error', e);
    return fallback;
  }
}
