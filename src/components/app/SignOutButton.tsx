'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
      className="mt-3 text-xs text-stone-mute underline-offset-2 hover:text-ink hover:underline"
    >
      Se déconnecter
    </button>
  );
}
