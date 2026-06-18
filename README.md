# MatterGuide AI

**Transformez n'importe quelle visite virtuelle Matterport en agent immobilier IA** : accueil vocal des acquéreurs, visite guidée automatique pilotant la caméra, réponses en temps réel basées sur vos documents (DPE, AG, copro…), qualification commerciale douce, CRM et analytics — le tout en SaaS multi-agences avec abonnements Stripe.

## Stack

Next.js 15 (App Router, TypeScript) · Tailwind CSS · Supabase (Postgres + pgvector, Auth, Storage, Realtime) · OpenAI (Realtime API voix WebRTC, embeddings, vision) · Matterport Showcase SDK · Stripe Billing · Vercel.

## Démarrage rapide (15 min)

### 1. Base de données Supabase
```bash
# Créez un projet sur https://supabase.com puis :
npx supabase link --project-ref VOTRE_REF
npx supabase db push          # applique supabase/migrations/*
# Dans le SQL Editor Supabase, exécutez aussi : supabase/seed.sql
```
Dans **Authentication → Providers → Email**, vous pouvez désactiver "Confirm email" pour tester plus vite.

### 2. Clés API
```bash
cp .env.example .env.local
```
| Variable | Où l'obtenir |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `OPENAI_API_KEY` | platform.openai.com (accès Realtime requis) |
| `NEXT_PUBLIC_MATTERPORT_SDK_KEY` | my.matterport.com → Settings → Developer Tools → SDK Key Management (ajoutez `localhost` et votre domaine) |
| `STRIPE_*` | Voir `docs/DEPLOYMENT.md` §Stripe |

### 3. Lancer
```bash
npm install
npm run dev
```
Ouvrez http://localhost:3000 → **Essai gratuit** → créez votre compte agence.

### 4. Premier bien en 2 minutes
1. Dashboard → **Charger le bien de démo** (maison Montreuil préconfigurée, modèle `F38iQKKXgr5`) — ou *Connecter un bien* avec votre propre lien Matterport.
2. Onglet **Pièces & parcours** : déplacez-vous dans la visite 3D, cliquez **Se placer ici** sur chaque pièce, puis **Synchroniser le modèle 3D**.
3. Onglet **Documents** : importez vos PDF (DPE, diagnostics, PV d'AG…) — indexation automatique.
4. **Publier** → copiez le lien de visite → vos acquéreurs parlent à l'IA.

## Fonctionnalités

- 🎙️ **Agent vocal temps réel** (OpenAI Realtime, WebRTC) avec interruption naturelle
- 🚶 **Visite guidée** : l'IA pilote la caméra pièce par pièce et commente vos points forts
- 🔎 **Mode libre contextuel** : l'IA sait dans quelle pièce se trouve le visiteur
- 📄 **RAG documents** : réponses sourcées sur vos PDF — *jamais d'invention de chiffres*
- 👁️ **Vision** : "qu'est-ce que c'est ?" → analyse de la vue 3D courante
- 🎯 **Qualification douce** : budget, financement, délai, projet — détectés en conversation
- 📋 **CRM pipeline** : visite → prospect → acquéreur chaud → offre → compromis → vente
- 📊 **Analytics** : temps par pièce, questions fréquentes, conversion
- 👥 **Visites de groupe** : caméra synchronisée en direct (vous pilotez, ils suivent)
- 💳 **SaaS** : multi-agences, essai 14 j, plans Stripe 99/299/799 €

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — schéma technique, flux voix/RAG/tour
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel, Stripe, Supabase, Docker, pas à pas
- [`docs/MATTERPORT.md`](docs/MATTERPORT.md) — clé SDK + workflow de mapping des pièces
- [`docs/API.md`](docs/API.md) — référence des routes API

## Scripts

```bash
npm run dev          # développement
npm run build        # build production
npm run start        # serveur production
npm run typecheck    # tsc --noEmit
```
