import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Client Supabase côté serveur (session utilisateur, RLS actives). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as never)
            );
          } catch {
            /* appelé depuis un Server Component : ignoré, le middleware rafraîchit la session */
          }
        },
      },
    }
  );
}

/** Renvoie le profil + organisation de l'utilisateur connecté, ou null. */
export async function getSessionContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single();
  if (!profile) return null;
  return { user, profile, supabase };
}
