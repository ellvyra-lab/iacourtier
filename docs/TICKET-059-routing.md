# Ticket 059 — profil courtier, clients et intentions

Correction locale du 20 octobre 2026 dans le Coach existant. OpenAI et son modèle configuré sont conservés. Aucune clé, dépendance, table, migration, configuration Vercel, configuration ou donnée bêta modifiée. Aucun commit, push ou déploiement pendant ce ticket.

## Cause

Le catalogue d'outils ne proposait pas de lecture du profil professionnel ni de comptage CRM. La consigne du prompt séparait déjà les identités pour la rédaction, mais ne donnait pas de fonction adaptée à une consultation du profil.

Une intention `search_clients` sans nom déclenchait une lecture paginée de tous les clients du courtier, suivie de l'affichage des 30 premiers. Le contrôle d'ancrage des noms pouvait supprimer une query générée par le modèle et laisser cette intention vide, ce qui déclenchait également la liste générale. Aucune confirmation de demande explicite de liste n'était nécessaire.

## Correction du mécanisme

- Ajout des intentions `get_professional_profile`, `count_clients` et `clarify_identity` dans le catalogue existant. Le prompt OpenAI distingue consultation du profil, contact CRM nommé, comptage, rédaction et retouche.
- Normalisation sémantique des lectures après classification, avec distinction des demandes de coordonnées propres, des tiers nommés et du sujet de conversation. Ce n'est pas une réponse codée uniquement pour la phrase du ticket : OpenAI continue à classifier les formulations naturelles; les garde-fous empêchent les replis dangereux.
- Lecture du profil par le helper serveur `professionalContext` déjà utilisé par les brouillons : `profiles.id = userId` authentifié. Réutilisation de `professional_profile`, `full_name` et `email`; aucun champ provenant d'une fiche client ou inventé par le modèle.
- Champs absents explicitement marqués « non renseigné ». Une signature composée depuis des coordonnées enregistrées est identifiée comme telle, plutôt que présentée comme une signature personnalisée enregistrée.
- Sujet `current_identity_target` conservé dans le JSON de contexte existant. Une consultation du profil garde le client déjà résolu et le brouillon en attente. Une nouvelle personne nommée devient le sujet client. Aucun deuxième système de mémoire.
- Ambiguïté sans sujet : clarification avant toute lecture CRM, puis reprise avec le mécanisme d'attente existant. Une question professionnelle ne doit pas être prise comme une nouvelle coordonnée à enregistrer pendant une rédaction.
- `search_clients` sans nom ne liste que sur demande explicite. Sans client résolu ni query, le résolveur ne charge plus la table pour rien. Une recherche de coordonnées avec un nom est dirigée vers les détails du client.
- Comptage `select('id', {count:'exact', head:true}).eq('user_id', userId)`, avec rôle acheteur/vendeur si demandé : pas de fiches renvoyées et pas de total tronqué à 30 ou 500. Un comptage indisponible produit une erreur, jamais un total supposé.
- Les retouches et propositions de modification de profil conservent leurs chemins existants et leurs confirmations. Une lecture ne remplace pas une action de rédaction. Aucun courriel envoyé lors des validations de ce ticket.

Les contrôles d'environnement existants restent inchangés. Aucune permission ou capacité bêta n'a été activée pour les nouvelles fonctions.

## Tests exécutés

### Régression locale

**168 tests réussis, 0 échec, 0 ignoré** sur les suites `scripts/*.test.mjs` hors suites live et `beta-database.test.mjs`. La suite qui crée la base synthétique bêta a été exclue pour ne pas travailler sur ce périmètre. Aucun accès à un projet Supabase réel pendant ces tests.

Les nouveaux tests couvrent :

- phrase du ticket avec une mauvaise intention `search_clients` injectée : lecture du profil, zéro lecture de clients;
- coordonnées, agence et téléphone propres, même en présence d'un client courant;
- suivis de profil après relecture du contexte et conservation du brouillon;
- coordonnées de Martin, puis son téléphone, sans prendre celles du courtier;
- vrai contrat de comptage exact avec 1 896 clients synthétiques et un autre propriétaire, sans liste ni troncature;
- ambiguïté, question ciblée et réponse « Moi » reprenant l'attente;
- liste CRM explicite seulement;
- données manquantes, valeurs de repli enregistrées, erreurs fournisseur et absence de renseignements inventés;
- deux courtiers avec profils, conversations et totaux distincts;
- rédaction à Martin avec la signature du courtier, consultation de l'agence pendant le brouillon puis « Ajoute mon téléphone à ce courriel » : destinataire, sujet et corps conservés, zéro envoi;
- brouillons, confirmations et autres fonctions couvertes par les suites existantes.

### Autorisation PostgreSQL réelle en local

Un test PGlite exécute le DDL `profiles` et les policies extraits du `supabase/schema.sql` existant, sans dupliquer leurs règles. Deux identités PostgreSQL `authenticated` avec des claims distincts consultent leur profil par le nouveau handler serveur. Lecture et modification du profil étranger sont refusées dans les deux sens, y compris si un ID étranger est fourni artificiellement au scope du test.

Ce test utilise le vrai moteur PostgreSQL et de vraies policies RLS, mais simule la couche Auth par les claims. **Il ne constitue pas deux connexions GoTrue/Supabase de production.** Aucune base bêta ou de production n'est ouverte par ce test.

### Classification OpenAI réellement exécutée

Autorisation utilisateur : dix appels maximum. Un premier essai a échoué sur la résolution DNS (`ENOTFOUND`) avant de fournir une classification. Après permission réseau, neuf appels de classification ont réussi. Une retouche a été résolue par le routeur de brouillon existant sans appel API. Dix tentatives au total, neuf réponses API réussies; aucun appel supplémentaire.

Modèle **demandé** inchangé : `gpt-4o-mini`. Le wrapper ne retourne pas l'identifiant de version du modèle dans sa valeur de sortie; aucun autre identifiant de modèle exécuté n'est affirmé. Les appels autorisés peuvent consommer les crédits API existants; aucun achat ni abonnement engagé.

| Formulation | Routage obtenu | Exécution |
|---|---|---|
| Phrase complète du ticket | `get_professional_profile` | OpenAI réel |
| Quelles sont mes coordonnées ? | `get_professional_profile` | OpenAI réel |
| Quelle est mon agence ? | `get_professional_profile` | OpenAI réel |
| Quel est mon numéro de téléphone ? | `get_professional_profile` | OpenAI réel |
| Trouve les coordonnées de Martin | `get_client`, query Martin | OpenAI réel |
| Prépare un courriel à Martin avec ma signature | `draft_email`, query Martin | OpenAI réel |
| Ajoute mon téléphone à ce courriel | `revise_email` | Routeur existant du brouillon |
| Combien ai-je de clients ? | `count_clients` | OpenAI réel |
| Les coordonnées ? | `clarify_identity` | OpenAI réel |
| Où est-ce que je travaille ? | `get_professional_profile` | OpenAI réel |

« Et l'agence ? » et les autres reprises ont été validés dans les tests locaux de contexte. Ce cas a été retiré du deuxième lot réseau afin de respecter le maximum d'appels autorisés après le premier échec DNS. Le script a été exécuté avec `--skip-followup`.

Ces tests réels valident le classement du nouveau code; ils ne rédigent ni n'envoient de vrai courriel, n'interrogent pas les vrais profils/clients et ne déploient pas la correction. Les tests de données et brouillons utilisent des fixtures synthétiques explicitement identifiées.

### Build

Build final Next terminé avec code 0, sous Node 24.19.0 via `scripts/build-verify.mjs`. Compilation, lint, vérification TypeScript et génération des routes exécutées. Aucun contrôle désactivé. Ce script utilise la sortie de compilation séparée déjà préparée pour les problèmes Windows. Le build classique et la configuration d'environnement bêta ne sont pas modifiés par ce ticket. Des avertissements préexistants restent présents; aucune erreur bloquante.

## État du diagnostic avant publication

Correction **non déployée**. L'URL de production demeure https://iacourtier-44za.vercel.app/tableau-de-bord/coach mais elle ne contient pas encore ce correctif. Aucun essai utilisateur de bout en bout sur la version corrigée déployée n'est prétendu. Le démarrage de serveur depuis l'outil ayant été refusé lors des travaux précédents, aucun contournement de cette restriction n'a été tenté.

Avant publication : isoler uniquement les changements de ce ticket des autres changements locaux déjà présents, valider la recette du profil réel et du brouillon dans l'application corrigée, puis publier selon un flux approuvé sans inclure les préparations bêta. Un déploiement ou des appels IA supplémentaires ne sont pas effectués implicitement.

Fichiers de ce ticket :

- `src/lib/coach/conversation.ts`
- `src/lib/server/coach-intent.ts`
- `src/lib/server/coach-professional-context.ts`
- `src/lib/server/coach-tools.ts`
- `src/lib/server/coach-pending.ts`
- `src/lib/server/process-coach-message.ts`
- `scripts/helpers/connected-test-harness.mjs`
- `scripts/coach-conversation.test.mjs`
- `scripts/coach-professional-email.test.mjs`
- `scripts/coach-identity-routing.test.mjs` (nouveau)
- `scripts/coach-profile-rls.test.mjs` (nouveau)
- `scripts/test-coach-identity-live.mjs` (nouveau, opt-in; `--plan` ne contacte aucun fournisseur)
- ce rapport.

Aucune migration SQL nécessaire. Les preuves sont exportées dans `outputs/ticket-059/` du dossier de travail parent, sans clé ni véritable coordonnée CRM.


## Préparation de la publication autorisée

Le correctif est isolé dans une copie propre du main GitHub f5fd7af6e8d634e5216fd79d085c05d35d4f52b3. Seuls les fichiers du ticket 059 sont retenus. Les préparations bêta, paramètres Vercel, variables, clés, migrations et données Supabase sont exclus de cette publication. Le dépôt de travail a repassé ses 168 tests et le build (lint et TypeScript inclus) le 20 octobre 2026. La réussite du déploiement doit être vérifiée séparément dans Vercel sur le SHA publié.

Validation de la copie de publication : 158 tests réussis, zéro échec/zéro ignoré (les 10 tests bêta ne sont pas livrés). npm run build réussi avec Node 24.19.0, lint et TypeScript strict inclus. Adaptation locale Windows : dossiers de sortie précréés, sortie séparée, nettoyage désactivé et un seul worker pendant la vérification; next.config.mjs et tsconfig.json sont ensuite rétablis octet pour octet, et aucune adaptation n'est committée. Les logs de production existants confirment pnpm 10.28.0 et le verrouillage pnpm inchangé. Aucun envoi de courriel ni modification de donnée métier pendant cette validation.
