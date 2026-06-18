import { NextResponse } from 'next/server';

// Stripe désactivé temporairement — stub pour éviter les erreurs 500
export async function POST() {
  return NextResponse.json({ received: true });
}
