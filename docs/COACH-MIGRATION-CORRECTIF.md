# Coach — correctif de préparation Supabase

## Cause et limite du diagnostic distant

Le texte « Le Coach n’est pas prêt : applique la migration de conversation Supabase » venait du POST `/api/coach/conversation`, action `new`, lorsque l’INSERT dans `public.coach_conversations` échouait. Toutes les erreurs Supabase produisaient ce même texte : il ne prouvait donc pas à lui seul une table absente. Le verrou RPC avait la même erreur générique.

La migration attendue est **`supabase/migrations/202609211054_coach_conversations.sql`**, déjà présente. La migration 055 des connexions ne la remplace pas : elle en dépend. Aucun nouveau système de conversation n’est créé.

Deux défauts corrigés dans la migration 054 : absence de grants explicites (dépendance aux privilèges par défaut du projet), et création de policies non rejouable. Elle est maintenant transactionnelle, rejouable, avec droits explicites, policies propriétaire et garde restrictive, indexes et rechargement du cache PostgREST. Les relations existantes ne sont ni supprimées ni vidées.

La base distante n’a pas été accessible dans cette session. La configuration locale ne contient que les variables OpenAI. Impossible d’affirmer à distance quelles tables/colonnes/policies manquent réellement. `supabase/diagnostics/coach_readiness.sql` fournit l’inventaire SQL en lecture seule. Un déploiement Vercel n’applique pas les migrations Supabase.

## SQL exact à appliquer

Dans le SQL Editor du **projet Supabase dont l’URL correspond au `NEXT_PUBLIC_SUPABASE_URL` de la production**, exécuter le contenu intégral de `supabase/migrations/202609211054_coach_conversations.sql`. Ce fichier est autonome pour les conversations (il dépend uniquement de `auth.users`, `auth.uid()` et des rôles Supabase). Ne pas utiliser une clé `service_role` dans le navigateur.

Exécuter ensuite `supabase/diagnostics/coach_readiness.sql`. Chaque colonne doit être PRESENT ; les quatre tables doivent avoir RLS activée. Si une table existante a été modifiée manuellement et ne correspond plus au schéma, conserver le diagnostic et l’erreur : ne pas supprimer de données ni inventer de propriétaire pour les réparer. La migration transactionnelle échoue sans appliquer une moitié du correctif.

## Objets attendus

| Table | Colonnes |
| --- | --- |
| coach_conversations | id, user_id, context, pending, created_at, updated_at |
| coach_messages | id, conversation_id, user_id, text, reply, status, created_at |
| coach_action_audit | id, user_id, conversation_id, message_id, action, entity_type, entity_id, before_value, after_value, status, source, created_at |
| coach_processing_locks | user_id, token, expires_at |

Les FK composites `(conversation_id,user_id)` empêchent d’attacher les messages d’un utilisateur à la conversation d’un autre. Les policies `coach_conversations_owner`, `coach_messages_owner`, `coach_audit_owner` et leurs guards imposent `user_id = auth.uid()` en lecture ET écriture. Les verrous ne sont pas accessibles directement au rôle authenticated : les fonctions `claim_coach_lock(uuid)` et `release_coach_lock(uuid)` utilisent exclusivement `auth.uid()`, avec search_path fixé. Aucun trigger n’est requis ; le moteur sauvegarde le contexte, pending et updated_at.

Indexes : clés primaires, unicité conversation `(id,user_id)`, `coach_messages_history`, `coach_conversations_owner_updated`, `coach_messages_owner_history`, `coach_action_audit_owner`.

## OpenAI et erreurs

`OPENAI_API_KEY` et `OPENAI_MODEL` sont lus sur le serveur ; `src/lib/openai.ts` porte maintenant la barrière `server-only`. Aucun préfixe NEXT_PUBLIC et aucun env injecté dans next.config. L’ancienne route de diagnostic exposait le nom du modèle : elle ne le renvoie plus, exige une session en développement et répond 404 en production.

Un échec OpenAI produit le message public d’erreur, aucun résultat métier inventé ni détail brut du fournisseur. Le message est sauvegardé en statut failed et exclu de l’historique completed fourni au modèle. Il reste visible après rechargement pour expliquer l’échec. Les erreurs de stockage distinguent schéma manquant/incomplet, permission refusée et panne temporaire ; seul le code et l’opération sont journalisés.

## Validation et test de réception

Tests automatisés : moteur Coach et connecteurs ; API création distincte, historique et propriétaire ; OpenAI 401 sans contenu inventé ni détail sensible ; PostgreSQL local PGlite exécutant réellement la migration deux fois, grants/RLS avec deux identités, FK, messages, contexte, verrous et refus anonyme. PGlite utilise des rôles/auth.uid de test et ne remplace pas une réception sur Supabase hébergé.

Pour reproduire le test SQL, installer `@electric-sql/pglite` dans un environnement de test et définir `PGLITE_MODULE` vers son module, puis `node --test scripts/coach-schema.test.mjs`. Tests applicatifs : `node --test scripts/coach-storage.test.mjs scripts/coach-conversation.test.mjs scripts/connected-assistant.test.mjs scripts/connected-oauth.test.mjs`.

URL : https://iacourtier.ca/tableau-de-bord/coach

1. Appliquer le SQL 054 dans le bon projet, puis ouvrir l’URL et se connecter.
2. Cliquer Nouvelle conversation, écrire « Trouve [un client existant] », envoyer ; vérifier la réponse puis « Ouvre son dossier » pour vérifier le contexte.
3. Rafraîchir : les messages doivent revenir ; envoyer « Qu’est-ce qui manque dans son dossier ? » et vérifier le contexte conservé. L’historique affiché est celui de la conversation active (100 messages maximum), conservée dans cet onglet via une clé sessionStorage propre à l’utilisateur.
4. Cliquer Nouvelle conversation : historique vide et contexte distinct. Avec un autre compte dans un autre navigateur, la requête GET d’historique avec l’ancien ID doit répondre 404 ; aucune donnée du premier compte ne doit apparaître.

Le parcours navigateur avec Supabase réel reste à exécuter après configuration/application du SQL. Les fonctionnalités courriel/agenda du ticket 055 nécessitent en plus leur migration et leurs identifiants OAuth ; elles ne sont pas nécessaires à la création d’une conversation.
