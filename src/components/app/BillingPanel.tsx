'use client';

import { PLANS } from '@/lib/stripe/plans';
import { PLAN_LIMITS } from '@/lib/types';
import type { Subscription } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

/**
 * BillingPanel — version "Stripe désactivé".
 * Affiche le plan actuel et la liste des offres en lecture seule.
 * Les boutons de souscription sont désactivés avec un message "bientôt disponible".
 */
export function BillingPanel({
  subscription,
  propertiesCount,
}: {
  subscription: Subscription | null;
  propertiesCount: number;
}) {
  const plan = subscription?.plan ?? 'trial';
  const isTrial = plan === 'trial';
  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400_000))
    : null;
  const limit = (PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial).properties;

  return (
    <div className="mt-8 space-y-8">

      {/* Bannière info */}
      <div className="rounded-2xl border border-brass/40 bg-brass/10 px-5 py-4 text-sm">
        <p className="font-medium">Facturation bientôt disponible</p>
        <p className="mt-1 text-stone-mute">
          La souscription en ligne sera ouverte prochainement.
          Contactez-nous pour activer votre plan dès maintenant.
        </p>
      </div>

      {/* Plan courant */}
      <div className="rounded-2xl border border-ink/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-stone-mute">Plan actuel</p>
            <p className="mt-0.5 font-display text-2xl capitalize">
              {isTrial ? 'Essai gratuit' : plan}
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800">
            {isTrial ? 'Essai en cours' : 'Actif'}
          </span>
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-stone-mute">Biens utilisés</dt>
            <dd className="mt-0.5 font-medium">
              {propertiesCount} / {limit >= 1000 ? 'illimité' : limit}
            </dd>
          </div>
          {isTrial && trialDaysLeft != null && (
            <div>
              <dt className="text-stone-mute">Fin de l'essai</dt>
              <dd className={cn('mt-0.5 font-medium', trialDaysLeft <= 3 && 'text-amber-700')}>
                {trialDaysLeft > 0
                  ? `Dans ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''}`
                  : 'Expiré'}
                {trialEnd && ` (${formatDate(trialEnd.toISOString())})`}
              </dd>
            </div>
          )}
          {!isTrial && subscription?.current_period_end && (
            <div>
              <dt className="text-stone-mute">Prochaine échéance</dt>
              <dd className="mt-0.5 font-medium">{formatDate(subscription.current_period_end)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Plans en lecture seule */}
      <div>
        <h2 className="font-display text-xl">Nos offres</h2>
        <p className="mt-1 text-sm text-stone-mute">
          Souscription en ligne disponible prochainement.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = p.tier === plan;
            return (
              <div
                key={p.tier}
                className={cn(
                  'flex flex-col rounded-2xl border bg-white p-5',
                  p.highlighted ? 'border-brass' : 'border-ink/10'
                )}
              >
                <p className="font-display text-lg">{p.name}</p>
                <p className="mt-2">
                  <span className="font-display text-3xl">{p.priceMonthly}€</span>
                  <span className="text-sm text-stone-mute"> /mois HT</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-stone-ink">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brass-deep">—</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled
                  className="mt-4 cursor-not-allowed rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-medium text-stone-mute opacity-60"
                >
                  {isCurrent ? 'Plan actuel' : 'Bientôt disponible'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
