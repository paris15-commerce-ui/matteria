/**
 * @deprecated — Agent vocal migré vers Groq + Web Speech API.
 * Backend : /api/chat/route.ts | Hook : src/hooks/useRealtimeAgent.ts
 */
export const REALTIME_MODEL = 'deprecated';
export const REALTIME_VOICE = 'deprecated';
export const REALTIME_BASE_URL = 'deprecated';
export async function createEphemeralSession(_: string): Promise<never> {
  throw new Error('createEphemeralSession: migré vers Groq. Utiliser /api/chat.');
}
