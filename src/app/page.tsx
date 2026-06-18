import Link from 'next/link';
import { PLANS } from '@/lib/stripe/plans';

const FEATURES = [
  {
    title: 'Agent vocal en temps réel',
    text: "Vos acquéreurs parlent naturellement à l'IA pendant la visite 3D : elle répond instantanément, à la voix, comme un agent sur place.",
  },
  {
    title: 'Visite guidée automatique',
    text: "L'IA pilote la caméra pièce par pièce, commente les points forts que vous avez définis, et s'interrompt dès qu'on lui pose une question.",
  },
  {
    title: 'Réponses sur vos documents',
    text: "DPE, PV d'AG, règlement de copro, taxe foncière : importez vos PDF, l'IA répond uniquement sur cette base — jamais d'invention.",
  },
  {
    title: 'Qualification douce',
    text: "Budget, financement, délai, projet : l'IA détecte les signaux dans la conversation et construit la fiche prospect sans interrogatoire.",
  },
  {
    title: 'CRM intégré',
    text: 'Chaque visite alimente un pipeline : visiteur → prospect → acquéreur chaud → offre → compromis → vente. Score d’intérêt automatique.',
  },
  {
    title: 'Analytics de visite',
    text: 'Temps passé par pièce, questions fréquentes, taux de conversion : sachez enfin ce qui se passe dans vos visites virtuelles.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-porcelain text-ink">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <p className="font-display text-xl tracking-tight">
          MatterGuide <span className="text-brass-deep">AI</span>
        </p>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="#tarifs" className="text-stone-ink hover:text-ink">Tarifs</Link>
          <Link href="/login" className="text-stone-ink hover:text-ink">Connexion</Link>
          <Link
            href="/signup"
            className="rounded-xl bg-ink px-4 py-2 font-medium text-porcelain transition hover:bg-ink-700"
          >
            Essai gratuit
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 text-center">
        <div className="halo mx-auto mb-10 h-20 w-20" data-state="speaking">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-brass to-brass-deep text-porcelain shadow-lg">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
          </div>
        </div>
        <h1 className="mx-auto max-w-3xl font-display text-4xl leading-[1.1] tracking-tight sm:text-6xl">
          Vos visites Matterport deviennent des <em className="text-brass-deep not-italic">agents immobiliers</em>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone-ink">
          Une IA vocale accueille chaque acquéreur dans la visite 3D, fait visiter,
          répond sur vos documents, qualifie — et remplit votre CRM. 24h/24.
        </p>
        <div className="mt-9 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-xl bg-ink px-7 py-3.5 font-medium text-porcelain transition hover:bg-ink-700"
          >
            Démarrer — 14 jours offerts
          </Link>
          <Link href="#fonctionnement" className="text-sm font-medium text-stone-ink hover:text-ink">
            Comment ça marche ↓
          </Link>
        </div>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-mute">
          Compatible avec toutes vos visites Matterport existantes
        </p>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement" className="border-y border-ink/10 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 sm:grid-cols-3">
          {[
            ['1', 'Collez votre lien Matterport', 'Ajoutez un bien en 2 minutes : ID du modèle 3D, prix, description, et vos PDF (DPE, diagnostics, AG…).'],
            ['2', "L'IA apprend le bien", 'Documents indexés, pièces cartographiées, points forts configurés. Vous choisissez même le prénom de votre agent.'],
            ['3', 'Partagez le lien de visite', "Chaque acquéreur est accueilli à la voix, guidé, renseigné, qualifié. Vous recevez la fiche prospect, scorée."],
          ].map(([n, title, text]) => (
            <div key={n}>
              <p className="font-mono text-sm text-brass-deep">Étape {n}</p>
              <h3 className="mt-2 font-display text-xl">{title}</h3>
              <p className="mt-2 leading-relaxed text-stone-ink">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl tracking-tight">Un agent qui ne dort jamais</h2>
        <div className="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <h3 className="font-display text-lg">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-stone-ink">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="tarifs" className="border-t border-ink/10 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center font-display text-3xl tracking-tight">Tarifs simples, sans engagement</h2>
          <p className="mt-3 text-center text-stone-ink">14 jours d'essai gratuit sur tous les plans.</p>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.tier}
                className={`rounded-3xl border p-8 ${
                  plan.highlighted ? 'border-brass bg-porcelain shadow-lg' : 'border-ink/10'
                }`}
              >
                {plan.highlighted && (
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-brass-deep">Le plus choisi</p>
                )}
                <h3 className="font-display text-xl">{plan.name}</h3>
                <p className="mt-4">
                  <span className="font-display text-4xl">{plan.priceMonthly}€</span>
                  <span className="text-stone-mute"> /mois HT</span>
                </p>
                <ul className="mt-6 space-y-2.5 text-[15px] text-stone-ink">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brass-deep">—</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-8 block rounded-xl px-4 py-3 text-center font-medium transition ${
                    plan.highlighted
                      ? 'bg-ink text-porcelain hover:bg-ink-700'
                      : 'border border-ink/15 hover:border-ink'
                  }`}
                >
                  Commencer l'essai
                </Link>
              </div>
            ))}
          </div>
          {/* Facturation — note temporaire */}
          <p className="mt-8 text-center text-sm text-stone-mute">
            Souscription en ligne disponible prochainement — accès immédiat sur demande.
          </p>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-10 text-sm text-stone-mute">
        <p>© {new Date().getFullYear()} MatterGuide AI</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Fait pour l'immobilier</p>
      </footer>
    </main>
  );
}
