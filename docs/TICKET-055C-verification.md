# Ticket 055C — Connexions depuis le Coach

Validation du 15 octobre 2026, sur main.

Le Coach propose les connexions Google/Microsoft dans le fil, en réutilisant OAuth et le coffre chiffré existants. Réglages → Connexions reste disponible. Les commandes explicites de connexion sont reconnues sans appel au modèle. Chaque demande est liée au propriétaire, à la conversation et au message. Les états privés sont accessibles uniquement au serveur; les identifiants de compte sont contrôlés côté serveur.

Le callback utilise un état OAuth à usage unique et reprend la conversation enregistrée, jamais une URL fournie par le navigateur. Un succès exige une lecture réelle des services autorisés. Refus, annulation et échec ne produisent aucune confirmation de connexion. Une reconnexion conserve les services déjà autorisés. Les demandes de connexion ne remplacent plus les clarifications ni les actions en attente.

## Migration

`supabase/migrations/202610141100_coach_connection_requests.sql` appliquée telle quelle dans le projet `yvgxipnfpylrktjyyjts` : Success. No rows returned.

Contrôle SQL en production : RLS=true, privilège SELECT authenticated=false, INSERT service_role=true. La table contient uniquement les demandes et états du parcours; les tokens restent dans le coffre existant. Les clés étrangères composites empêchent de référencer la conversation, le message ou le compte d'un autre utilisateur.

## Tests

- 56 tests Node passent : conversations, mémoire, connexions, OAuth, comptes multiples, providers et centre de connexions.
- 3 tests PostgreSQL/PGlite passent : migration, conservation des comptes et tokens, contraintes de propriétaire et interdiction d'accès au navigateur.
- TypeScript `tsc --noEmit --incremental false` : réussi.
- `npm run build` exécuté localement : échec Windows EPERM lors du mkdir `.next/types/app/api/seller-listings/[id]/documents`. Le build Vercel du même arbre a réussi, déploiement Production Ready `6Lt5hauisf7bqECRB5t314DXYY4y`, commit `0c58f56bbf68f9bb3dc52f80da79797c9d4565d8`.

## Tests réels en production

URL : https://iacourtier-44za.vercel.app/tableau-de-bord/coach

- « Quels comptes sont connectés ? » : les deux comptes existants apparaissent, services et défauts conservés.
- « Connecte mon deuxième Gmail » et « Ajoute mon calendrier » : cartes officielles offertes, annulation enregistrée sans modifier les comptes.
- Reconnexion de sonia.bernier@remax-quebec.com : OAuth Google officiel, lectures Gmail et Calendar vérifiées côté serveur, retour au même fil, état vérifié conservé après refresh. Aucun doublon de compte.
- Refus avec Annuler sur Google : retour au même fil, état annulé et message « Autorisation refusée ou annulée. Aucun accès confirmé. »; accès existants conservés.
- « Déconnecte ce compte » après reconnexion : cible Remax retrouvée, confirmation de révocation exigée. Carte annulée en production pour conserver les accès. L'exécution de révocation et son idempotence sont couvertes par tests automatisés; la révocation réelle avait été vérifiée lors du ticket 055B.
- « Connecte Centris » : intégration non disponible, seul lien préparatoire vers les dossiers CRM. Aucun accès Centris inventé.
- Nouveau fil puis refresh : reste distinct du fil OAuth précédent.
- « Ajoute demain un rappel pour vérifier le rendez-vous avec la maman de Francis » → « À quelle heure ? » → reconnexion Google complète → refresh → « 11 h » : aperçu retrouvé avec le titre initial, 16 octobre 2026 à 11 h, America/Toronto, agenda par défaut. Aperçu annulé ensuite; aucun événement créé ni courriel envoyé par ces essais.

Google reste une application en mode test avec avertissement de validation Google; aucune permission Contacts supplémentaire n'a été accordée pendant ces essais. Microsoft conserve son chemin existant et n'a pas été testé avec un compte réel pour ce ticket. Les états d'erreur fournisseur et l'isolation entre propriétaires sont testés automatiquement.

## Fichiers

- src/components/coach-conversation.tsx
- src/lib/coach/conversation.ts
- src/lib/server/coach-intent.ts
- src/lib/server/process-coach-message.ts
- src/lib/server/connections/accounts.ts
- src/lib/server/connections/coach-connections.ts
- src/lib/server/connections/verify.ts
- src/app/api/coach/connections/route.ts
- src/app/api/coach/conversation/route.ts
- src/app/api/connections/[provider]/callback/route.ts
- supabase/migrations/202610141100_coach_connection_requests.sql
- scripts/coach-connections.test.mjs
- scripts/coach-connections-schema.test.mjs
- scripts/coach-conversation.test.mjs
- docs/TICKET-055C-verification.md
