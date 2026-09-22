# Ticket 055 — configuration et réception

Le code ajoute les API réelles Gmail, Google Calendar et Microsoft Graph au même `processCoachMessage()` que le CRM. Aucune donnée de démonstration ni réussite simulée n’est utilisée dans l’application.

**Réception réelle non terminée tant que les applications OAuth et Supabase ne sont pas configurés et que les scénarios ci-dessous ne sont pas exécutés avec des comptes de test.** Les tests unitaires de transport et le banc d’essai UI ne constituent pas une connexion Google/Microsoft réelle.

## Installation

1. Appliquer les migrations existantes du CRM, puis `supabase/migrations/202609211054_coach_conversations.sql` et `supabase/migrations/202609221055_connected_assistant.sql` dans le projet Supabase cible.
2. Configurer les variables de `.env.connections.example` dans l’environnement cible. Ne jamais mettre un secret dans une variable `NEXT_PUBLIC_*`.
3. Créer une clé de chiffrement de 32 octets, par exemple avec `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Conserver cette clé côté serveur. Changer ou perdre cette clé rend les anciens jetons illisibles : prévoir une reconnexion ou une migration de chiffrement.
4. Redéployer, ouvrir Réglages → Connexions, connecter les comptes de test avec leur propriétaire connecté à IACourtier.

| Variable | Fonction |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Authentification et CRM existants |
| `SUPABASE_SERVICE_ROLE_KEY` | Accès serveur aux jetons, références et aperçus protégés |
| `CONNECTIONS_ENCRYPTION_KEY` | AES-256-GCM, base64 de 32 octets, jamais exposée au navigateur |
| `CONNECTIONS_APP_URL` | Origine exacte des retours OAuth, `http://localhost:3100` ou `https://iacourtier.ca` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Application OAuth Web Google |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Application Web Microsoft Entra |
| `MICROSOFT_TENANT_ID` | Tenant autorisé ; défaut `common`, selon les types de comptes de l’application |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Analyse et routage existants du Coach |

## Google

Activer Gmail API et Google Calendar API dans Google Cloud. Configurer l’écran de consentement et les utilisateurs de test. Créer un client OAuth de type application Web. Ajouter les URI exactes, sans variation de domaine :

- `http://localhost:3100/api/connections/google/callback`
- `https://iacourtier.ca/api/connections/google/callback`

Scopes demandés : `openid`, `email`, `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.compose`, `https://www.googleapis.com/auth/calendar.events`.

`gmail.readonly` sert à la lecture ; `gmail.compose` aux brouillons et à leur envoi. L’application ne demande pas l’accès complet de suppression de la boîte. Les scopes Gmail restreints nécessitent de vérifier les exigences Google de publication/validation avant une ouverture publique. La configuration locale utilise `access_type=offline`, consentement et PKCE. Les autorisations partielles sont refusées explicitement.

Références officielles : [OAuth serveur](https://developers.google.com/identity/protocols/oauth2/web-server), [scopes Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [envoi Gmail](https://developers.google.com/workspace/gmail/api/guides/sending), [scopes Calendar](https://developers.google.com/workspace/calendar/api/auth).

## Microsoft

Enregistrer une application Microsoft Entra. Autoriser les types de comptes souhaités, cohérents avec le tenant configuré. Créer un secret côté serveur et des URI de redirection **Web** :

- `http://localhost:3100/api/connections/microsoft/callback`
- `https://iacourtier.ca/api/connections/microsoft/callback`

Permissions **déléguées**, pas application : `User.Read`, `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, avec `openid`, `email`, `offline_access`. Respecter la politique de consentement du tenant de test. Le code utilise le flux authorization code avec PKCE et renouvellement, puis uniquement les API `/me` avec le jeton du propriétaire vérifié.

Graph retourne `202 Accepted` pour l’envoi d’un brouillon. L’interface dit donc que Microsoft a accepté l’envoi ; elle ne prétend pas connaître la livraison au destinataire. Déconnecter supprime les jetons locaux. Le retrait global du consentement Microsoft reste accessible dans les paramètres du compte Microsoft.

Références officielles : [flux OAuth](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [permissions](https://learn.microsoft.com/en-us/graph/permissions-reference), [brouillon de réponse](https://learn.microsoft.com/en-us/graph/api/message-createreply?view=graph-rest-1.0), [envoi d’un brouillon](https://learn.microsoft.com/en-us/graph/api/message-send?view=graph-rest-1.0).

## Fichiers principaux

- `src/lib/server/connections/accounts.ts` : OAuth, PKCE, état consommé atomiquement, chiffrement lié au propriétaire, renouvellement et déconnexion.
- `src/lib/connections/types.ts` et `src/lib/server/connections/providers.ts` : contrats communs et adaptateurs Gmail/Graph/Calendar.
- `src/lib/server/connections/coach-connected.ts` : courriels, CRM, topo, alertes par fil, agenda, aperçus et exécution confirmée.
- `src/lib/server/process-coach-message.ts`, `coach-intent.ts`, `coach-tools.ts` : routage partagé avec texte et voix, contexte persistant, tâches.
- `src/lib/connections/dates.ts` : conversion fr-CA/America/Toronto, heure d’été/hiver et refus des heures ambiguës.
- `src/components/coach-conversation.tsx`, `connected-accounts.tsx` : topo, aperçus modifiables, confirmations et connexions.
- `src/app/api/connections/` : routes authentifiées de connexion et retours OAuth.
- `supabase/migrations/202609221055_connected_assistant.sql` : six tables serveur protégées et métadonnées conditionnelles des tâches.
- `scripts/connected-assistant.test.mjs`, `connected-oauth.test.mjs`, `connected-intent-live.test.mjs` : vérifications locales et routage OpenAI réel optatif.

## Sécurité et comportement

Les tables de jetons, tentatives OAuth, références, alertes, audit et actions ne sont pas accessibles aux rôles `anon` et `authenticated`. Le serveur résout l’utilisateur par sa session Supabase et filtre chaque accès administratif par cet utilisateur. Le navigateur ne peut pas écrire un destinataire ou un contenu directement dans un aperçu exécutable.

Les modifications d’un brouillon créent un nouvel aperçu avec un nouvel identifiant. Un ancien onglet ne peut donc pas confirmer un contenu remplacé. La transition atomique `preview → executing` bloque le double clic et le rejeu. Une interruption d’envoi passe en résultat incertain, sans réessai automatique : il faut vérifier Gmail/Outlook. Cela empêche de transformer un problème réseau en double envoi automatique ; cela ne promet pas une garantie de livraison « exactement une fois » chez les fournisseurs.

Les rendez-vous sont contrôlés à la préparation et à la confirmation. Les modifications/suppressions utilisent la version fournisseur ; une version manquante est refusée. Les références CRM proviennent des données du propriétaire et sont revalidées avant exécution. Les budgets et préqualifications extraits d’un courriel nécessitent une confirmation.

Les alertes sont regroupées par fil et actualisées lors d’une analyse demandée. Aucun message externe ni notification n’est envoyé par ces alertes. Le suivi « vendredi s’il ne répond pas » crée une tâche datée et une condition `manual_check` ; aucun surveillant en arrière-plan n’est annoncé.

## URLs à tester

| Écran | Local | Production configurée |
| --- | --- | --- |
| Connexions | `http://localhost:3100/tableau-de-bord/parametres/connexions` | `https://iacourtier.ca/tableau-de-bord/parametres/connexions` |
| Coach | `http://localhost:3100/tableau-de-bord/coach` | `https://iacourtier.ca/tableau-de-bord/coach` |
| Accueil / topo | `http://localhost:3100/tableau-de-bord` | `https://iacourtier.ca/tableau-de-bord` |

## Réception réelle restante — Google puis Microsoft

1. Connecter un compte de test, constater l’adresse vérifiée et relire après rafraîchissement. Tester consentement refusé, renouvellement et déconnexion.
2. Recevoir un vrai courriel de test demandant un document ; demander « À quoi dois-je répondre ? », lire le fil et vérifier le dossier proposé.
3. Préparer une réponse, modifier le texte, enregistrer le nouvel aperçu puis confirmer. Vérifier dans le fournisseur le destinataire, le bon fil, le message réel et l’absence de doublon. Vérifier la timeline du dossier. Une réponse Graph acceptée doit être vérifiée dans Outlook.
4. Continuer avec « Fais-moi une tâche pour midi » : vérifier titre, dossier, date du jour et 12 h à Toronto après rafraîchissement.
5. Vérifier une plage libre puis une plage occupée. Préparer une visite, confirmer, relire depuis le Coach et depuis le fournisseur. Tester le conflit créé entre aperçu et confirmation.
6. Déplacer/supprimer un rendez-vous et vérifier la confirmation ainsi que le refus si sa version a changé.
7. Demander le topo : comparer aux courriels réels, réponses reçues, tâches, rendez-vous et conditions du CRM. Vérifier qu’une source inaccessible est signalée.
8. Avec deux vrais utilisateurs Supabase A/B, tenter d’appeler les routes avec les identifiants de B depuis A. Les tables privées doivent être inaccessibles directement, et aucun jeton de B ne doit être utilisé.
9. Tester le microphone et le clavier sur un téléphone réel ; la dictée utilise le même moteur que le texte.

## Limites V1 explicites

- Un compte par fournisseur et l’agenda principal uniquement ; pas de vue de disponibilité fusionnée des calendriers secondaires.
- Fenêtres bornées : recherche courriel 30 jours, topo/suivis 7 jours ; au plus 20 messages et 12 fils par compte lors de l’analyse. Les chiffres ne représentent pas toute la boîte.
- Résumé limité aux 8 derniers messages du fil ; Gmail conserve jusqu’aux 30 derniers dans le connecteur. Les fils Outlook au-delà de 100 messages sont refusés avec explication. Agenda au-delà de 250 événements : préciser la période.
- Les pièces jointes sont listées avec leurs métadonnées ; téléchargement et envoi de pièces jointes ne sont pas ajoutés dans cette V1.
- Les événements créés sont dans l’agenda du compte, sans ajout automatique de participants externes. Les liens CRM sont conservés dans IACourtier et la timeline ; le Coach relit l’événement chez le fournisseur.
- Pas de worker de surveillance, push, VoIP, SMS, portail, marketing ni automatisation Centris.
- Le déploiement du code seul ne crée pas les applications OAuth, n’applique pas les migrations et ne configure pas les secrets.
