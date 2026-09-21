# Ticket 054 — Coach conversationnel

Le Coach devient l’accueil (`/tableau-de-bord`) et reste disponible dans un panneau depuis les autres modules. La vue d’ensemble précédente reste à `/tableau-de-bord/accueil`. Le bouton vocal et la saisie texte utilisent la même conversation et `processCoachMessage()`.

## Fonctionnement

1. L’API identifie l’utilisateur avec la session Supabase côté serveur.
2. Le message et son ID sont enregistrés dans la conversation propriétaire.
3. OpenAI propose une intention validée, jamais une table, un SQL ou un utilisateur cible.
4. Le serveur résout les noms et conserve les vrais IDs. Plusieurs correspondances suspendent l’action et présentent des choix.
5. Le registre appelle les actions CRM centrales. Les changements utilisent les mêmes tables que l’interface traditionnelle.
6. Les écritures sont journalisées avec conversation, message, utilisateur, entité, avant/après et `source=coach_ai`.
7. La réponse, les liens et le contexte sont persistés. Les écrans CRM ouverts se rechargent sur `crm-updated`.

Un verrou par utilisateur sérialise les requêtes concurrentes du Coach. Un message déjà traité est retourné sans réexécuter ses écritures. Un message interrompu n’est pas relancé automatiquement. Les services CRM historiques effectuent plusieurs écritures; une panne intermédiaire peut laisser un résultat partiel, à vérifier avant de reformuler la demande. Le journal conserve les actions commencées et échouées.

## Actions branchées

- Recherche clients, dossiers, tâches, documents, propriétés et pipeline.
- Lecture d’un dossier, complétude, manquants et prochaine action calculée par le moteur existant.
- Création client/projet acheteur ou vendeur via le service de capture existant; déduplication et choix du dossier avant exécution dans le Coach.
- Critères acheteurs, budget, secteurs (ajout sans effacer les autres), financement et rappels.
- Modification coordonnées client, notes et renseignements de propriété via les actions existantes.
- Création, report et clôture de tâches; sélection exacte depuis les cartes; fiche tâche accessible par ID.
- Transition de pipeline via le service métier existant.
- Brouillon de courriel avec destinataire, objet, message, modification et copie. Aucun envoi.
- Appel par lien `tel:`. Aucun appel automatique ou VoIP.

Exemples : « Trouve Jacques Blanchette », « Ouvre son dossier », « Qu’est-ce qui manque ? », « Rappelle-moi vendredi de lui demander les documents manquants », « Change son budget à 600 000 $ », « Ajoute Mascouche dans ses secteurs », « Écris-y pour demander son certificat de localisation ».

Les interfaces futures sont déclarées mais non connectées : envoi de courriel, calendrier externe, marketing, prospection, import conversationnel, vérification de propriété, préparation Centris, SMS et portail client. Le routage répond honnêtement lorsqu’une intégration est indisponible.

## Migration et configuration

Appliquer **après les migrations existantes** `supabase/migrations/202609211054_coach_conversations.sql`.

Elle ajoute uniquement les conversations, messages, journal et verrous techniques; aucun doublon des tables clients/dossiers/tâches. Les tables utilisent RLS et les fonctions de verrou utilisent `auth.uid()`.

Aucune nouvelle variable d’environnement. Réutilisées :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optionnelle selon la configuration existante)

Sans migration, le Coach affiche qu’il n’est pas prêt et n’annonce aucune écriture réussie.

## Validation

- `npm run build` : compilation, lint et TypeScript strict.
- `npm run test:coach` : 11 tests exécutant les résolveurs, registre, capture et moteur métier sur un double de contrat Supabase. A/B/C/D/E couverts au niveau service, plus isolation, rejeu et choix successifs.
- Suites CRM, moteur de pipeline, accès clients, inbox/appels et ticket 058 : 35 tests.
- `node --env-file=.env.local --test scripts/coach-intent-live.test.mjs` : 10 essais explicites avec le vrai modèle OpenAI, uniquement sur les exemples du ticket. Aucun accès CRM.
- Vérification visuelle du composant réel dans un banc UI isolé : 390×844, 1440×900 et 390×500; saisie, cartes, choix, brouillon modifiable, zone microphone visible et absence de débordement horizontal. Aucun avertissement ou erreur console observé.

**Limites de validation :** aucun environnement Supabase de test n’était configuré dans la copie locale. La migration n’a donc pas été appliquée, les politiques RLS n’ont pas été éprouvées sur une base réelle, et les parcours A–E avec rafraîchissement du CRM réel restent à valider. Les tests UI utilisent des réponses de test et ne prouvent pas la persistance Supabase. La capture vocale réutilise Web Speech `fr-CA`; l’enregistrement réel au microphone et le clavier d’un téléphone physique restent à tester.

## URLs à tester après migration et déploiement

- https://iacourtier.ca/tableau-de-bord
- https://iacourtier.ca/tableau-de-bord/coach
- https://iacourtier.ca/tableau-de-bord/accueil
- https://iacourtier.ca/tableau-de-bord/clients
- https://iacourtier.ca/tableau-de-bord/pipeline

Les liens dossiers, propriétés et tâches sont générés à partir des IDs réels. Aucun ID de production n’est inventé dans cette livraison.

## Fichiers principaux

- `src/lib/coach/conversation.ts` : contrats, registre descriptif, liens.
- `src/lib/server/coach-intent.ts` : compréhension et ancrage des entités dans le message courant.
- `src/lib/server/process-coach-message.ts` : session, historique, ambiguïtés, verrou et rejeu.
- `src/lib/server/coach-tools.ts` : résolution et exécution des outils, audit.
- `src/lib/server/coach-crm-actions.ts` : actions tâches partagées et critères acheteurs.
- `src/lib/server/process-quick-capture.ts` : sélection du dossier et protection des données existantes.
- `src/app/api/coach/conversation/route.ts` : API authentifiée.
- `src/components/coach-conversation.tsx` : interface, panneau, voix, cartes, brouillons.
- `src/components/universal-quick-capture.tsx` : point d’entrée commun vers le Coach.
- Pages accueil, Coach, vue d’ensemble et tâches; layout du tableau de bord.
- Écrans client, dossier, propriété, liste clients et pipeline : actualisation immédiate.
- `scripts/coach-conversation.test.mjs`, `scripts/coach-intent-live.test.mjs` et migration SQL.
