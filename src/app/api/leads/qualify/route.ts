import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const QUAL_FIELDS = ['interest_level', 'budget', 'financing', 'timeline', 'purpose'] as const;

/**
 * Qualification live pendant la visite — appelée par les tools de l'agent
 * (update_lead_qualification, capture_contact). Les données sont accumulées
 * sur la visite ; le lead est consolidé/score à la clôture (/visits/[id]/end).
 * Si un contact est capturé, le lead est créé immédiatement (zéro perte).
 */
export async function POST(req: NextRequest) {
  try {
    const { visitId, field, value, contact } = (await req.json()) as {
      visitId: string;
      field?: string;
      value?: string;
      contact?: { full_name?: string; email?: string; phone?: string };
    };
    if (!visitId) return NextResponse.json({ error: 'visitId requis' }, { status: 400 });

    const admin = createAdminClient();
    const { data: visit } = await admin.from('visits').select('*').eq('id', visitId).single();
    if (!visit) return NextResponse.json({ error: 'Visite introuvable' }, { status: 404 });

    const qualification = { ...(visit.qualification ?? {}) } as Record<string, unknown>;

    if (field && QUAL_FIELDS.includes(field as (typeof QUAL_FIELDS)[number]) && value) {
      qualification[field] = String(value).slice(0, 300);
    }
    if (contact) {
      if (contact.full_name) qualification.full_name = String(contact.full_name).slice(0, 120);
      if (contact.email) qualification.email = String(contact.email).slice(0, 160);
      if (contact.phone) qualification.phone = String(contact.phone).slice(0, 40);
    }

    await admin.from('visits').update({ qualification }).eq('id', visitId);

    // Contact capturé -> lead immédiat (même si la visite est abandonnée ensuite)
    let leadId: string | null = visit.lead_id;
    if (contact && (contact.full_name || contact.email || contact.phone)) {
      if (leadId) {
        await admin
          .from('leads')
          .update({
            full_name: (qualification.full_name as string) ?? undefined,
            email: (qualification.email as string) ?? undefined,
            phone: (qualification.phone as string) ?? undefined,
            qualification,
          })
          .eq('id', leadId);
      } else {
        const { data: lead } = await admin
          .from('leads')
          .insert({
            organization_id: visit.organization_id,
            property_id: visit.property_id,
            visit_id: visitId,
            full_name: (qualification.full_name as string) ?? null,
            email: (qualification.email as string) ?? null,
            phone: (qualification.phone as string) ?? null,
            stage: 'prospect',
            qualification,
          })
          .select('id')
          .single();
        leadId = lead?.id ?? null;
        if (leadId) await admin.from('visits').update({ lead_id: leadId }).eq('id', visitId);
      }
    }

    return NextResponse.json({ ok: true, saved: true, leadId });
  } catch (e) {
    console.error('[leads/qualify]', e);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }
}
