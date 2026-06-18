import { NextResponse } from 'next/server';

/**
 * Route conservée pour compatibilité — agent vocal migré vers Groq + Web Speech API.
 * L'endpoint actif est désormais /api/chat.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Route obsolète — utiliser /api/chat' },
    { status: 410 }
  );
}
