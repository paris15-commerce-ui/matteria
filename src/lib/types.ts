// ---------- Types métier (miroir du schéma SQL) ----------

export type LeadStage = 'visite' | 'prospect' | 'acquereur_chaud' | 'offre' | 'compromis' | 'vente';
export type VisitMode = 'libre' | 'guidee' | 'groupe';
export type PlanTier = 'trial' | 'starter' | 'pro' | 'agence';
export type DocumentType =
  | 'dpe' | 'diagnostics' | 'pv_ag' | 'reglement_copro' | 'taxe_fonciere'
  | 'annonce' | 'mandat' | 'fiche_commerciale' | 'autre';

export const LEAD_STAGES: { value: LeadStage; label: string }[] = [
  { value: 'visite', label: 'Visite' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'acquereur_chaud', label: 'Acquéreur chaud' },
  { value: 'offre', label: 'Offre' },
  { value: 'compromis', label: 'Compromis' },
  { value: 'vente', label: 'Vente' },
];

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'dpe', label: 'DPE' },
  { value: 'diagnostics', label: 'Diagnostics' },
  { value: 'pv_ag', label: 'PV d’AG' },
  { value: 'reglement_copro', label: 'Règlement de copropriété' },
  { value: 'taxe_fonciere', label: 'Taxe foncière' },
  { value: 'annonce', label: 'Annonce' },
  { value: 'mandat', label: 'Mandat' },
  { value: 'fiche_commerciale', label: 'Fiche commerciale' },
  { value: 'autre', label: 'Autre' },
];

export interface Property {
  id: string;
  organization_id: string;
  title: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  property_type: string | null;
  price: number | null;
  surface: number | null;
  rooms_count: number | null;
  description: string | null;
  highlights: string[];
  facts: Record<string, string>;
  matterport_model_id: string;
  agent_name: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface PropertyRoom {
  id: string;
  property_id: string;
  label: string;
  matterport_room_id: string | null;
  sweep_ids: string[];
  position: { x: number; y: number; z: number } | null;
  talking_points: string[];
  tour_order: number;
  include_in_tour: boolean;
}

export interface PropertyDocument {
  id: string;
  property_id: string;
  name: string;
  type: DocumentType;
  status: 'processing' | 'ready' | 'error';
  pages: number | null;
  chunk_count: number | null;
  error: string | null;
  created_at: string;
}

export interface Qualification {
  interest_level?: number;       // 0-100
  budget?: string;
  financing?: string;            // "accord de principe", "cash", "à monter"…
  timeline?: string;             // "moins de 3 mois"…
  purpose?: string;              // "résidence principale" | "investissement"
  objections?: string[];
  summary?: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  property_id: string | null;
  visit_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  stage: LeadStage;
  score: number;
  qualification: Qualification;
  notes: string | null;
  created_at: string;
  updated_at: string;
  properties?: { title: string } | null;
}

export interface Visit {
  id: string;
  organization_id: string;
  property_id: string;
  lead_id: string | null;
  mode: VisitMode;
  visitor_label: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  rooms_visited: { label: string; seconds: number }[];
  transcript: TranscriptEntry[];
  qualification: Qualification;
  engagement_score: number | null;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

export interface Subscription {
  organization_id: string;
  plan: PlanTier;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_end: string | null;
  current_period_end: string | null;
}

export const PLAN_LIMITS: Record<PlanTier, { properties: number; label: string }> = {
  trial: { properties: 2, label: 'Essai gratuit' },
  starter: { properties: 5, label: 'Starter' },
  pro: { properties: 25, label: 'Pro' },
  agence: { properties: 1000, label: 'Agence' },
};
