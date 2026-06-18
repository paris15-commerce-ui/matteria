'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Identifiants invalides.');
      setLoading(false);
      return;
    }
    router.replace('/app');
    router.refresh();
  };

  return (
    <div className="rounded-3xl border border-ink/10 bg-white p-8 shadow-sm">
      <h1 className="font-display text-xl">Connexion</h1>
      <div className="mt-6 space-y-3">
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" autoComplete="email"
          className="w-full rounded-xl border border-ink/15 px-4 py-3 focus:border-brass-deep focus:outline-none"
        />
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe" autoComplete="current-password"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full rounded-xl border border-ink/15 px-4 py-3 focus:border-brass-deep focus:outline-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={submit} disabled={loading || !email || !password}
          className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-porcelain transition hover:bg-ink-700 disabled:opacity-50"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </div>
      <p className="mt-6 text-center text-sm text-stone-mute">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="font-medium text-brass-deep hover:underline">Essai gratuit 14 jours</Link>
      </p>
    </div>
  );
}
