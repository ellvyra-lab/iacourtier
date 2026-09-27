# Ticket 056 — centre de connexions

## État de livraison

Le centre réutilise le système OAuth, les fournisseurs Gmail/Calendar, les aperçus confirmables et le topo du ticket 055. L'ancienne URL reste disponible; l'URL principale est désormais :

https://iacourtier-44za.vercel.app/tableau-de-bord/reglages/connexions

**La réception réelle Google n'est pas terminée.** Lors de la vérification Vercel, seuls NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY et OPENAI_MODEL étaient présents. Google Cloud affichait des comptes déconnectés. Aucun jeton réel Google, courriel envoyé ou événement créé n'est revendiqué par cette livraison.

## Variables Vercel

Configurer sur le projet **iacourtier-44za**, environnement Production :

| Variable | Valeur / usage |
| --- | --- |
| CONNECTIONS_APP_URL | `https://iacourtier-44za.vercel.app` |
| GOOGLE_CLIENT_ID | Identifiant du client OAuth Web Google Cloud |
| GOOGLE_CLIENT_SECRET | Secret de ce même client, côté serveur seulement |
| CONNECTIONS_ENCRYPTION_KEY | 32 octets aléatoires encodés en base64, sauvegardés durablement comme secret |
| SUPABASE_SERVICE_ROLE_KEY | Clé serveur du projet `yvgxipnfpylrktjyyjts`, jamais préfixée NEXT_PUBLIC |
| NEXT_PUBLIC_SUPABASE_URL | Déjà présente; doit viser le même projet Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Déjà présente; clé publique du même projet |
| OPENAI_API_KEY / OPENAI_MODEL | Déjà présentes; utilisées uniquement sur le serveur |

Redéployer après l'enregistrement des variables. Ne pas renouveler arbitrairement CONNECTIONS_ENCRYPTION_KEY : les jetons existants deviendraient indéchiffrables. Microsoft reste facultatif (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID).

## Google Cloud

1. Choisir le projet de l'application et activer **Gmail API** et **Google Calendar API**.
2. Configurer Google Auth Platform : identité de l'application, domaine autorisé, contact, page d'accueil et politique de confidentialité. Pour un pilote externe, ajouter explicitement le compte du testeur. Pour commercialiser, effectuer la vérification Google requise pour les scopes Gmail restreints et le traitement serveur des données.
3. Créer un client OAuth de type **Application Web**.
4. Enregistrer exactement la redirection ci-dessous et placer ses identifiants dans Vercel. La connexion Google n'est pas le fournisseur de connexion Supabase : c'est une autorisation distincte, liée à l'utilisateur IACourtier déjà connecté.

Redirect URI exacte :

`https://iacourtier-44za.vercel.app/api/connections/google/callback`

Scopes demandés :

- `openid`
- `email`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.compose`
- `https://www.googleapis.com/auth/calendar.events`

`gmail.compose` couvre les brouillons et leur envoi; aucun scope de suppression de boîte complète n'est demandé. La disponibilité est calculée à partir des événements de l'agenda principal, donc aucun scope FreeBusy supplémentaire n'est requis. OAuth utilise state à usage unique lié au propriétaire, PKCE S256 et access_type=offline. Les jetons sont chiffrés AES-256-GCM avec identité du propriétaire dans les données authentifiées.

Références officielles : [OAuth serveur Google](https://developers.google.com/identity/protocols/oauth2/web-server), [scopes Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [scopes Calendar](https://developers.google.com/workspace/calendar/api/auth), [pièces jointes Gmail](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get).

## Supabase

Exécutées sans erreur dans `yvgxipnfpylrktjyyjts` :

- `202609221055_connected_assistant.sql` : migration existante; ajout de transaction et notification PostgREST dans le fichier. Crée les six tables privées des connexions. À exécuter une seule fois, avant 056.
- `202609261056_connection_center.sql` : indexes OAuth, références et événements; droits serveur renforcés. Rejouable.

Les six tables ont RLS activée; anon et authenticated n'ont aucun accès SQL direct, y compris aux jetons chiffrés et aux actions à confirmer. Les routes authentifient l'utilisateur et le serveur filtre les comptes, références, aperçus et données CRM par propriétaire. Les identifiants retournés au navigateur n'incluent aucun jeton OAuth.

## Fonctions branchées

Gmail : recherche, lecture, fils, récents/non lus, liste et téléchargement des pièces jointes jusqu'à 3 Mo, aperçu de réponse, création de brouillon fournisseur et envoi après confirmation. Le brouillon du Coach est d'abord un aperçu conservé dans IACourtier; le brouillon Gmail est créé lors de la confirmation puis envoyé. Aucun envoi avant cette confirmation.

Calendar : lecture, recherche, disponibilité sur l'agenda principal, création et modification avec aperçu, contrôle de conflit au moment de confirmer et contrôle de version. La déconnexion supprime les accès locaux et tente la révocation Google. Un refresh refusé demande une reconnexion; une panne temporaire conserve l'autorisation.

Ces fonctions disposent de chemins API réels et de tests automatisés; **aucune n'a encore été validée de bout en bout avec un compte Google réel dans cet environnement**.

## Événements et automatisations

Les lectures à la demande du Coach émettent des événements dédupliqués dans `crm_events` : `email_received`, `email_received_from_client` (expéditeur reconnu par adresse exacte), `email_reply_needed`. Les créations/modifications d'agenda confirmées émettent `calendar_event_created` / `calendar_event_updated`.

Une demande de réponse détectée par l'IA, reliée à un expéditeur CRM connu et un dossier, prépare une tâche de vérification et une entrée dans `automations`. `validation_required` est activé et `external_delivery_enabled` reste faux. Un lien ambigu ne crée pas de tâche attachée arbitrairement. Aucun nouveau client n'est créé à partir d'un courriel.

Il s'agit d'une analyse à la demande : aucun webhook, polling permanent ou cron n'est activé. Le topo annonce les limites de lecture (20 courriels et 12 fils par compte); l'agenda ne déclare pas une disponibilité si la liste est tronquée.

## Centris

État réel : **Non configuré — Intégration officielle à configurer**. `CentrisProvider` définit getConnectionStatus, searchListings, getListing et getReferenceTables. L'implémentation inactive refuse les opérations; une variable fictive ne peut pas la rendre connectée. Le Coach peut consulter le statut réel. La préparation manuelle existante reste indépendante.

Il manque une autorisation Centris pour IACourtier précisant le périmètre des données, les utilisateurs admissibles, les services/endpoints permis, les mécanismes de jetons, les limites de synchronisation, les droits sur les photos et références. Toute transmission Saisie nécessite une autorisation et une documentation distinctes; aucun endpoint d'écriture n'est inventé.

L'existence de [services documentés Centris](https://secure.centris.ca/Service.asmx?op=Authentification) ne constitue pas une autorisation d'accès. Aucun scraping ni mot de passe Centris n'est utilisé.

## Réception réelle à effectuer après configuration

1. Se connecter au CRM puis à Google dans Connexions. Vérifier le compte affiché et utiliser « Vérifier l'accès » (lecture réelle Gmail et Calendar, aucune écriture).
2. Demander le topo, rechercher un courriel de test, ouvrir son fil et une pièce jointe. Préparer une réponse à un destinataire de test explicitement choisi; confirmer puis vérifier le vrai message envoyé une seule fois.
3. Lire l'agenda, vérifier un créneau, préparer un événement de test puis confirmer. Le déplacer après aperçu; contrôler le résultat dans Google Calendar.
4. Déconnecter, vérifier le refus d'accès, reconnecter; révoquer l'autorisation dans Google et contrôler le statut Reconnexion nécessaire. Tester avec deux utilisateurs CRM pour vérifier l'isolation.

Ne pas annoncer le ticket entièrement terminé avant cette réception.

## Vérifications effectuées

- `npm run build` : réussi.
- TypeScript : aucune erreur.
- 25 tests connexions/OAuth/fournisseurs/schéma PostgreSQL : réussis.
- 18 tests de régression Coach, stockage et relations : réussis.
- Interface locale : statuts non connectés, boutons désactivés sans configuration et explication Centris vérifiés.
- Les migrations ont renvoyé un succès dans le SQL Editor. La session Supabase a expiré avant la lecture du contrôle final des privilèges en production. Les restrictions RLS et les refus de lecture directe ont été vérifiés dans PostgreSQL local (PGlite); le contrôle final en production reste à reprendre.
- Google réel : non testé, configuration OAuth et session administrateur manquantes.

## Fichiers de cette livraison
- `docs/ticket-056-connection-center.md`
- `scripts/connection-center-schema.test.mjs`
- `scripts/connection-center.test.mjs`
- `src/app/api/connections/[provider]/callback/route.ts`
- `src/app/api/connections/[provider]/route.ts`
- `src/app/api/connections/attachments/route.ts`
- `src/app/api/connections/route.ts`
- `src/app/tableau-de-bord/parametres/page.tsx`
- `src/app/tableau-de-bord/reglages/connexions/page.tsx`
- `src/components/coach-conversation.tsx`
- `src/components/connected-accounts.tsx`
- `src/lib/centris/connector.ts`
- `src/lib/centris/provider.ts`
- `src/lib/coach/conversation.ts`
- `src/lib/connections/types.ts`
- `src/lib/server/connections/accounts.ts`
- `src/lib/server/connections/business-events.ts`
- `src/lib/server/connections/centris.ts`
- `src/lib/server/connections/coach-connected.ts`
- `src/lib/server/connections/providers.ts`
- `supabase/migrations/202609221055_connected_assistant.sql`
- `supabase/migrations/202609261056_connection_center.sql`
