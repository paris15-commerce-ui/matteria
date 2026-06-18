import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildAgentInstructions } from '@/lib/ai/prompts';
import type { Property, PropertyRoom, VisitMode } from '@/lib/types';

export const runtime = 'nodejs';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

/** Outils exposés à l'agent (format OpenAI function calling, compatible Groq). */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'navigate_to_room',
      description: "Déplace la caméra vers une pièce. Utilise ce tool dès que le visiteur demande à voir un espace.",
      parameters: {
        type: 'object',
        properties: { room: { type: 'string', description: 'Libellé exact de la pièce' } },
        required: ['room'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_property_documents',
      description: "Recherche dans les documents du bien (DPE, diagnostics, PV AG, règlement copropriété, taxe foncière). OBLIGATOIRE avant toute réponse chiffrée.",
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Mots-clés de recherche' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_current_view',
      description: "Analyse visuellement ce que le visiteur regarde en ce moment.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_qualification',
      description: "Enregistre un signal de qualification (budget, financement, délai, projet). N'annonce jamais au visiteur.",
      parameters: {
        type: 'object',
        properties: {
          field: { type: 'string', enum: ['interest_level', 'budget', 'financing', 'timeline', 'purpose'] },
          value: { type: 'string' },
        },
        required: ['field', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'capture_contact',
      description: "Enregistre les coordonnées données volontairement par le visiteur.",
      parameters: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_guided_tour',
      description: "Lance la visite guidée automatique.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop_guided_tour',
      description: "Interrompt la visite guidée.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'skip_to_next_stop',
      description: "Passe à l'étape suivante du parcours guidé.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: unknown[];
};

/**
 * POST /api/chat
 * Body : { propertyId, visitId?, mode?, messages: ChatMessage[] }
 * Returns : { reply } | { reply: '', toolCalls, assistantMsg }
 *
 * Protocole tool calls (2 tours) :
 *   Tour 1 : client envoie messages → Groq répond avec tool_calls
 *             → on retourne { toolCalls, assistantMsg } au client
 *   Tour 2 : client reconstruit l'historique complet (user + assistantMsg + tool results)
 *             et rappelle /api/chat → Groq produit la réponse finale
 */
export async function POST(req: NextRequest) {
  try {
    const { propertyId, visitId, mode, messages } = await req.json() as {
      propertyId: string;
      visitId?: string | null;
      mode?: VisitMode;
      messages: ChatMessage[];
    };

    if (!propertyId) return NextResponse.json({ error: 'propertyId requis' }, { status: 400 });

    const admin = createAdminClient();

    // ---- Récupérer le bien + pièces (lecture seule, accès public) ----
    const { data: property } = await admin
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .eq('is_published', true)
      .single<Property>();

    if (!property) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });

    const { data: rooms } = await admin
      .from('property_rooms')
      .select('*')
      .eq('property_id', propertyId)
      .order('tour_order');

    // ---- Construire les messages pour Groq ----
    const systemPrompt = buildAgentInstructions({
      property,
      rooms: (rooms ?? []) as PropertyRoom[],
      mode: mode ?? 'libre',
    });

    const groqMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // ---- Appel Groq ----
    const groqRes = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('[api/chat] Groq error', groqRes.status, err);
      return NextResponse.json({ error: 'Groq indisponible' }, { status: 502 });
    }

    const data = await groqRes.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    // ---- Réponse texte simple ----
    if (!msg?.tool_calls?.length) {
      return NextResponse.json({ reply: msg?.content ?? '' });
    }

    // ---- Tool calls → renvoyer au client pour exécution browser ----
    // On retourne aussi assistantMsg pour que le client puisse reconstruire
    // l'historique complet (user → assistant+tool_calls → tool results)
    // avant de rappeler /api/chat au tour suivant.
    const toolCalls = msg.tool_calls.map((tc: any) => ({
      callId: tc.id,
      name: tc.function.name,
      args: (() => { try { return JSON.parse(tc.function.arguments ?? '{}'); } catch { return {}; } })(),
    }));

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    };

    return NextResponse.json({ reply: '', toolCalls, assistantMsg });

  } catch (e) {
    console.error('[api/chat]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
