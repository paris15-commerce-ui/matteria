import type { Qualification } from '@/lib/types';

/**
 * Score d'intérêt 0-100 d'un prospect.
 * Base = interest_level estimé par l'IA, bonus par signal concret.
 */
export function computeLeadScore(opts: {
  qualification: Qualification;
  durationSeconds?: number | null;
  roomsCount?: number;
  questionsCount?: number;
}): number {
  const { qualification: q, durationSeconds, roomsCount = 0, questionsCount = 0 } = opts;
  let score = q.interest_level ?? 20;

  if (q.budget) score += 10;
  if (q.financing && /accord|cash|comptant|valid/i.test(q.financing)) score += 12;
  else if (q.financing) score += 5;
  if (q.timeline && /(moins|<|1|2|3).{0,12}mois|imm[ée]diat|rapide/i.test(q.timeline)) score += 12;
  else if (q.timeline) score += 5;
  if (q.purpose) score += 4;

  if ((durationSeconds ?? 0) > 360) score += 6;       // > 6 min de visite
  if (roomsCount >= 5) score += 4;                     // a tout regardé
  if (questionsCount >= 3) score += 6;                 // s'implique

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function suggestStage(score: number): 'visite' | 'prospect' | 'acquereur_chaud' {
  if (score >= 70) return 'acquereur_chaud';
  if (score >= 40) return 'prospect';
  return 'visite';
}
