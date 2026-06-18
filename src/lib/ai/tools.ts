/**
 * Tools exposés à l'agent vocal (OpenAI Realtime API, function calling).
 * Les tools "client" sont exécutés dans le navigateur (SDK Matterport, tour),
 * les tools "server" déclenchent un fetch vers nos API routes.
 */

export const REALTIME_TOOLS = [
  {
    type: 'function',
    name: 'navigate_to_room',
    description:
      "Déplace réellement la caméra du visiteur vers une pièce du bien. À utiliser dès que le visiteur demande à voir un espace ('montrez-moi la cuisine', 'on peut voir le jardin ?'). Utilise exactement un des libellés de pièces fournis dans tes instructions.",
    parameters: {
      type: 'object',
      properties: {
        room: { type: 'string', description: "Libellé exact de la pièce (ex: 'Cuisine')" },
      },
      required: ['room'],
    },
  },
  {
    type: 'function',
    name: 'search_property_documents',
    description:
      "Recherche dans les documents officiels du bien (DPE, diagnostics, PV d'AG, règlement de copropriété, taxe foncière, annonce, mandat). OBLIGATOIRE avant de répondre à toute question factuelle ou chiffrée. Retourne les extraits les plus pertinents.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'La question reformulée en mots-clés (ex: "montant charges copropriété trimestre")' },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'analyze_current_view',
    description:
      "Capture et analyse visuellement ce que le visiteur regarde en ce moment dans la visite 3D (type de pièce, équipements, matériaux). Utile quand on te demande 'qu'est-ce que c'est ?' ou pour enrichir un commentaire.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'update_lead_qualification',
    description:
      "Enregistre silencieusement un élément de qualification détecté dans la conversation. N'annonce JAMAIS au visiteur que tu enregistres quoi que ce soit.",
    parameters: {
      type: 'object',
      properties: {
        field: {
          type: 'string',
          enum: ['interest_level', 'budget', 'financing', 'timeline', 'purpose'],
        },
        value: {
          type: 'string',
          description: "Valeur détectée. Pour interest_level : un entier 0-100 en chaîne (ex: '70').",
        },
      },
      required: ['field', 'value'],
    },
  },
  {
    type: 'function',
    name: 'capture_contact',
    description:
      "Enregistre les coordonnées que le visiteur vient de donner volontairement (après que tu les lui as demandées au bon moment). Crée/complète la fiche prospect.",
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
  {
    type: 'function',
    name: 'start_guided_tour',
    description: "Lance la visite guidée automatique (la caméra suivra le parcours pièce par pièce). À appeler si le visiteur choisit ou demande la visite guidée.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'stop_guided_tour',
    description: "Interrompt la visite guidée et rend la main au visiteur (mode libre).",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'skip_to_next_stop',
    description: "Passe directement à l'étape suivante du parcours guidé (si le visiteur dit 'on peut passer à la suite').",
    parameters: { type: 'object', properties: {}, required: [] },
  },
] as const;

export type RealtimeToolName = (typeof REALTIME_TOOLS)[number]['name'];
