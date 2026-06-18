import { NextResponse } from 'next/server';

// Stripe désactivé temporairement
export async function POST() {
  return NextResponse.json(
    { error: 'La facturation sera disponible prochainement.' },
    { status: 503 }
  );
}
