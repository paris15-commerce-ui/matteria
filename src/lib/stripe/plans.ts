import type { PlanTier } from '@/lib/types';

export interface Plan {
  tier: Exclude<PlanTier, 'trial'>;
  name: string;
  priceMonthly: number;       // EUR, affichage
  priceEnv: string;           // variable d'env contenant le price_id Stripe
  properties: number;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    tier: 'starter',
    name: 'Starter',
    priceMonthly: 99,
    priceEnv: 'STRIPE_PRICE_STARTER',
    properties: 5,
    features: [
      '5 biens connectés',
      'Agent vocal IA illimité',
      'Visites guidées + libres',
      'CRM & qualification automatique',
      'Import documents (RAG)',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    priceMonthly: 299,
    priceEnv: 'STRIPE_PRICE_PRO',
    properties: 25,
    highlighted: true,
    features: [
      '25 biens connectés',
      'Tout Starter',
      'Visites de groupe',
      'Mode visio agent',
      'Analytics avancées',
    ],
  },
  {
    tier: 'agence',
    name: 'Agence',
    priceMonthly: 799,
    priceEnv: 'STRIPE_PRICE_AGENCE',
    properties: 1000,
    features: [
      'Biens illimités (fair use 1000)',
      'Tout Pro',
      'Multi-utilisateurs',
      'Support prioritaire',
      'Onboarding dédié',
    ],
  },
];

export function planFromPriceId(priceId: string): Exclude<PlanTier, 'trial'> | null {
  for (const p of PLANS) {
    if (process.env[p.priceEnv] === priceId) return p.tier;
  }
  return null;
}

export const TRIAL_DAYS = 14;
