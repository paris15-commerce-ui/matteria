import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/app/SignOutButton';

const NAV = [
  { href: '/app', label: 'Tableau de bord' },
  { href: '/app/properties', label: 'Biens' },
  { href: '/app/crm', label: 'CRM' },
  { href: '/app/analytics', label: 'Analytics' },
  { href: '/app/settings', label: 'Abonnement' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');

  return (
    <div className="min-h-screen bg-porcelain">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink/10 px-5 py-7 sm:flex">
          <Link href="/app" className="font-display text-lg tracking-tight">
            MatterGuide <span className="text-brass-deep">AI</span>
          </Link>
          <nav className="mt-9 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-[15px] text-stone-ink transition hover:bg-white hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-ink/10 pt-4">
            <p className="truncate text-sm font-medium">{ctx.profile.organizations?.name}</p>
            <p className="truncate text-xs text-stone-mute">{ctx.user.email}</p>
            <SignOutButton />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Nav mobile */}
          <div className="flex gap-1 overflow-x-auto border-b border-ink/10 px-3 py-2 sm:hidden">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-stone-ink">
                {item.label}
              </Link>
            ))}
          </div>
          <main className="px-5 py-8 sm:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
