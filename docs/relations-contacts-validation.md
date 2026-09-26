# Relations entre contacts

La table centrale `client_relationships` existante est réutilisée. Les relations sont visibles depuis les deux contacts; les participants restent dans `client_case_clients`. Aucun changement d'adresse n'est propagé.

## Migration

`supabase/migrations/202609231100_client_relationships.sql` étend la migration CRM du 25 août. Elle normalise les liens symétriques, conserve le sens parent/enfant, bloque les doublons inverses et impose le même propriétaire aux deux contacts. Elle s'arrête sans effacer de données si des doublons historiques nécessitent une intervention.

Exécutée avec succès dans le projet `yvgxipnfpylrktjyyjts`. Vérification SQL après exécution : RLS activée, policies propriétaire et garde restrictive présentes, trigger/fonction et index unique présents. Jacques Blanchette et Marie-Claude Lepine-Lavallé conservent deux identifiants individuels; une seule relation `spouse` est enregistrée.

Le dossier existant trouvé pour Jacques est « Vente — 145 des Hirondelle ». Le ticket demande le 175 : aucune participation en production n'a été ajoutée sans clarification de cette différence.

## Vérifications

- `npm run build` : réussi.
- TypeScript : réussi.
- 46 tests de régression Coach, stockage, connexions et import : réussis.
- 4 tests ciblés : modèle bidirectionnel, import de deux personnes partageant des coordonnées, scénario Coach/dossiers/contexte avec base simulée, destinataires Gmail/Graph sans envoi.
- PostgreSQL PGlite : migration réappliquée, doublon inverse refusé, isolation propriétaire, relation interutilisateurs refusée, accès anonyme refusé, adresses indépendantes, orientation parent/enfant.
- 5 appels OpenAI réels sur des formulations synthétiques : création du lien, résolution de la conjointe, ajout au dossier, aperçu de courriel commun et dossiers du couple.
- Interface avec composant réel et API simulée : recherche, enregistrement, ouverture du contact lié, lien inverse, rechargement et ajout explicite à un dossier.

Le test PostgreSQL est facultatif : définir `PGLITE_MODULE` vers une installation de `@electric-sql/pglite`, puis exécuter `node --test scripts/client-relationships-schema.test.mjs`. Le test OpenAI est facultatif et nécessite une clé serveur : `node --env-file=.env.local --test scripts/client-relationships-intent-live.test.mjs`.

La session du navigateur de production redirige vers la connexion. Le scénario complet dans une session CRM authentifiée et l'envoi fournisseur réel restent à vérifier. Aucun courriel de test n'a été envoyé.

## Test manuel

1. Se connecter à https://iacourtier-44za.vercel.app/tableau-de-bord/clients et ouvrir Jacques; vérifier le lien Conjoint(e), puis ouvrir Marie-Claude et vérifier le lien inverse.
2. Recharger les deux fiches; vérifier qu'elles restent distinctes. Modifier uniquement la fiche souhaitée et vérifier que l'autre conserve ses informations.
3. Après confirmation du bon dossier (145 ou 175), choisir celui-ci dans la section Relations et ajouter explicitement le contact comme participant; vérifier qu'aucun autre dossier n'a changé.
4. Dans le Coach, demander « Qui est la conjointe de Jacques ? », puis « Montre-moi les dossiers de ce couple ». La demande de courriel prépare un aperçu avec les deux adresses et exige une confirmation avant envoi, ainsi qu'un compte courriel connecté.

## Fichiers

- `src/lib/client-relationships.ts`
- `src/lib/server/client-relationships.ts`
- `src/lib/server/coach-relationships.ts`
- `src/app/api/clients/[id]/relationships/route.ts`
- `src/app/api/clients/route.ts`
- `src/components/client-relationships.tsx`
- `src/components/client-360-workspace.tsx`
- `src/components/clients-cases-dashboard.tsx`
- `src/lib/coach/conversation.ts`
- `src/lib/server/coach-intent.ts`
- `src/lib/server/coach-tools.ts`
- `src/lib/server/process-coach-message.ts`
- `src/lib/connections/types.ts`
- `src/lib/server/connections/coach-connected.ts`
- `src/lib/server/connections/providers.ts`
- `src/lib/universal-import.ts`
- `src/app/api/universal-import/analyze/route.ts`
- `src/app/api/universal-import/confirm/route.ts`
- `src/components/imported-relationship-suggestions.tsx`
- `src/components/universal-document-importer.tsx`
- `scripts/client-relationships.test.mjs`
- `scripts/client-relationships-schema.test.mjs`
- `scripts/client-relationships-intent-live.test.mjs`
- `supabase/migrations/202609231100_client_relationships.sql`
- `docs/relations-contacts-validation.md`
