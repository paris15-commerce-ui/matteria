import { NextResponse } from 'next/server';

// Stripe désactivé temporairement
export async function POST() {
  return NextResponse.json(
    { error: 'Le portail de facturation sera disponible prochainement.' },
    { status: 503 }
  );
}
