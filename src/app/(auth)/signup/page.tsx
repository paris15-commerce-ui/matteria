'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [agency, setAgency] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Lues par le trigger handle_new_user (création org + profil + essai 14 j)
        data: { full_name: name, organization_name: agency || `${name} Immobilier` },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      router.replace('/app');
      router.refresh();
    } else {
      setInfo('Vérifiez votre boîte mail pour confirmer votre adresse.');
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-ink/10 bg-white p-8 shadow-sm">
      <h1 className="font-display text-xl">Créer un compte</h1>
      <p className="mt-1 text-sm text-stone-mute">Essai gratuit 14 jours — sans carte bancaire.</p>
      <div className="mt-6 space-y-3">
        <input value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="Nom de l'agence"
          className="w-full rounded-xl border border-ink/15 px-4 py-3 focus:border-brass-deep focus:outline-none" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" autoComplete="name"
          className="w-full rounded-xl border border-ink/15 px-4 py-3 focus:border-brass-deep focus:outline-none" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email professionnel" autoComplete="email"
          className="w-full rounded-xl border border-ink/15 px-4 py-3 focus:border-brass-deep focus:outline-none" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (8+ caractères)" autoComplete="new-password"
          className="w-full rounded-xl border border-ink/15 px-4 py-3 focus:border-brass-deep focus:outline-none" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-emerald-700">{info}</p>}
        <button onClick={submit} disabled={loading || !email || password.length < 8 || !name}
          className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-porcelain transition hover:bg-ink-700 disabled:opacity-50">
          {loading ? 'Création…' : 'Démarrer l’essai gratuit'}
        </button>
      </div>
      <p className="mt-6 text-center text-sm text-stone-mute">
        Déjà inscrit ? <Link href="/login" className="font-medium text-brass-deep hover:underline">Connexion</Link>
      </p>
    </div>
  );
}
