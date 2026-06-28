# IACourtier.ca

Plateforme SaaS complète pour les courtiers immobiliers du Québec — assistants IA, automatisations, abonnements et tableau de bord membre.

Construit avec Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase, Stripe, OpenAI et Sentry.

## Démarrage

```bash
npm install
npm run dev
```

Le site est accessible sur `http://localhost:3000`. Sans aucune variable
d'environnement configurée, **tout le site s'affiche correctement** —
seuls les appels aux services externes (IA, paiement, comptes) renvoient
un message clair plutôt qu'un résultat réel, jusqu'à ce que vous les
configuriez (voir ci-dessous).

## ⚠️ Déploiement

Ce projet utilise des routes API (authentification, génération IA,
paiements). Il doit être déployé sur une plateforme qui supporte Next.js
complet — **Vercel** est recommandé (`npx vercel`, zéro configuration).

---

## Architecture

```
src/
  app/
    (site)/              → pages publiques (accueil, assistants-ia, automatisations, blog...)
    tableau-de-bord/      → application membre (protégée par middleware)
      assistants/[slug]/  → l'outil réel pour chacun des 10 Assistants IA
      historique/         → historique réel des générations (Supabase)
      abonnement/         → gestion d'abonnement (Stripe)
    api/
      generate/           → cœur du produit : auth + limite + appel OpenAI + sauvegarde
      stripe/checkout/    → démarre un abonnement Stripe
      stripe/webhook/     → synchronise Stripe → Supabase
      stripe/portal/      → portail de gestion d'abonnement Stripe
      subscribe/          → capture de leads (guide gratuit, newsletter)
  data/
    assistantsConfig.ts   → LES 10 ASSISTANTS V1 — formulaire + prompt système, un seul fichier
    plans.ts              → limites de génération par forfait
  lib/
    openai.ts              → appel à l'API OpenAI, avec gestion d'erreur dédiée
    stripe.ts               → client Stripe
    supabase/               → clients Supabase (navigateur, serveur, admin)
  middleware.ts            → protège /tableau-de-bord, gère les sessions
supabase/
  schema.sql               → schéma complet à exécuter dans Supabase (profiles, generations)
```

## Pourquoi seulement 10 Assistants IA

Le produit est volontairement scopé à **exactement 10 assistants** pour une
V1 fiable plutôt que 300 assistants instables. Ajouter un 11e assistant
plus tard ne demande qu'une seule chose : ajouter un objet dans
`src/data/assistantsConfig.ts` (champs du formulaire + prompt système).
Tout le reste — formulaire, validation, génération, sauvegarde, historique,
limite d'usage, copier/régénérer — fonctionne automatiquement pour
n'importe quel assistant grâce au composant partagé `AssistantRunner`.

---

## Configuration complète (dans l'ordre recommandé)

### 1. Supabase (comptes, base de données, historique) — requis en premier

1. Créez un projet sur [supabase.com](https://supabase.com) (gratuit).
2. **SQL Editor** → collez le contenu de `supabase/schema.sql` → Run.
   Ceci crée les tables `profiles` (forfait, compteur d'usage) et
   `generations` (historique), avec la sécurité (RLS) déjà configurée.
3. **Settings → API** → copiez :
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ serveur seulement,
     ne jamais exposer au navigateur)
4. Authentication → Providers → Email → désactivez "Confirm email" pour
   simplifier l'inscription (optionnel).

### 2. OpenAI (fait fonctionner les Assistants IA)

1. Créez une clé sur [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. `OPENAI_API_KEY=sk-...`
3. `OPENAI_MODEL=gpt-4o-mini` (rapide et économique — modifiable).

Sans cette clé, chaque assistant affiche : *« L'assistant IA est
temporairement indisponible »* avec un bouton Réessayer — aucun crash.

### 3. Stripe (abonnements)

1. [dashboard.stripe.com/products](https://dashboard.stripe.com/products) →
   créez deux produits récurrents : **Essentiel** (47$/mois) et **Pro**
   (97$/mois). Copiez chaque Price ID (`price_...`).
2. `STRIPE_PRICE_ESSENTIEL=price_...` et `STRIPE_PRICE_PRO=price_...`
3. `STRIPE_SECRET_KEY` depuis [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys).
4. [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) →
   ajoutez un endpoint pointant vers `https://votredomaine.ca/api/stripe/webhook`,
   écoutez `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` → copiez le signing secret dans
   `STRIPE_WEBHOOK_SECRET`.

### 4. Sentry (monitoring des erreurs)

1. Créez un projet Next.js sur [sentry.io](https://sentry.io).
2. Copiez le DSN dans `NEXT_PUBLIC_SENTRY_DSN`.
3. (Optionnel, pour les source maps en production) `SENTRY_ORG`,
   `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

### 5. MailerLite (déjà configuré depuis la version précédente)

Voir les variables `MAILERLITE_API_KEY` / `MAILERLITE_GROUP_ID`.

---

## Comment fonctionne un Assistant IA, de bout en bout

1. Le membre remplit le formulaire sur `/tableau-de-bord/assistants/[slug]`.
2. Le navigateur appelle `POST /api/generate` avec le slug + les valeurs.
3. Le serveur vérifie la session (sinon : 401, message clair).
4. Le serveur vérifie la limite du forfait dans `profiles` (sinon : 403,
   invite à passer à un forfait supérieur).
5. Le serveur appelle OpenAI avec le prompt système de l'assistant (sinon,
   en cas d'échec réseau ou de clé manquante : 503, message « service
   temporairement indisponible », et la tentative ratée est tout de même
   enregistrée dans l'historique avec le statut "failed").
6. Le résultat est sauvegardé dans `generations` et le compteur d'usage
   est incrémenté.
7. Le résultat s'affiche, avec boutons **Copier** et **Régénérer**.

## Limites par forfait

| Forfait | Générations / mois |
|---|---|
| Gratuit | 10 |
| Essentiel | 200 |
| Pro | Illimité |

Modifiable dans `src/lib/plans.ts`.

## Gestion des erreurs et fiabilité

- Chaque appel à un service externe (Supabase, OpenAI, Stripe) est protégé
  par un `try/catch` qui renvoie un message clair en français plutôt qu'un
  crash.
- Toute génération échouée est tout de même enregistrée dans l'historique
  (statut `failed`), pour pouvoir diagnostiquer les problèmes récurrents.
- Sentry capture automatiquement les erreurs non gérées, côté serveur et
  navigateur, dès que `NEXT_PUBLIC_SENTRY_DSN` est configuré.
- `/tableau-de-bord` est protégé par middleware : impossible d'y accéder
  sans session active (redirection vers `/connexion`).

## Personnaliser les chiffres et témoignages

- Statistiques de crédibilité : `src/data/stats.ts`
- Témoignages : `src/data/testimonials.ts`
- Les 10 Assistants IA (formulaire + prompt) : `src/data/assistantsConfig.ts`
