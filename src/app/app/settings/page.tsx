import { Suspense } from 'react';
import { getSessionContext } from '@/lib/supabase/server';
import { BillingPanel } from '@/components/app/BillingPanel';
import type { Subscription } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Abonnement : plan courant, essai, changement de plan, portail Stripe. */
export default async function SettingsPage() {
  const ctx = (await getSessionContext())!;
  const { data: subscription } = await ctx.supabase
    .from('subscriptions')
    .select('*')
    .eq('organization_id', ctx.profile.organization_id)
    .single<Subscription>();

  const { count: propertiesCount } = await ctx.supabase
    .from('properties')
    .select('id', { count: 'exact', head: true });

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl tracking-tight">Abonnement</h1>
      <p className="mt-1 text-stone-mute">{ctx.profile.organizations?.name}</p>
      <Suspense>
        <BillingPanel subscription={subscription} propertiesCount={propertiesCount ?? 0} />
      </Suspense>
    </div>
  );
}
