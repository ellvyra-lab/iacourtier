# Ticket 055A — mémoire conversationnelle

Cause : `coach_conversations.pending` ne conservait que les choix de contacts/dossiers. Les questions libres (heure, titre) étaient des exceptions ordinaires : l'action initiale était perdue et la réponse suivante repassait dans le modèle. Les dates relatives et le fuseau n'étaient pas fixés dans l'action.

Correction : réutilisation du JSON `pending` existant, lié par les requêtes serveur à l'utilisateur authentifié et à la conversation. L'action validée, le texte original, les sélections, le fuseau et la date absolue sont persistés. Une heure seule reprend cette action sans reconstruire son titre avec le modèle. Les corrections d'heure/date/titre remplacent l'aperçu ; annulation ou nouveau sujet effacent l'action en attente. Un calendrier absent ou une erreur de préparation conserve l'action pour reprise explicite.

Les créations utilisent les providers Calendar existants, les aperçus `connected_actions`, leur confirmation et leur verrou de tentative unique. Aucun nouveau calendrier, système CRM ou interface. Les dates suivent le fuseau du navigateur validé côté serveur et refusent les heures ambiguës/inexistantes lors des changements d'heure.

Tests locaux : 36 tests réussis (moteur conversationnel, calendrier/providers, tâches), dont reprise après relecture de la base, correction d'aperçu, annulation, calendrier absent, contexte de courriel, dates/fuseaux et confirmation sans double appel.

La validation réelle de production et le résultat du build sont à consigner après déploiement. Aucune réussite externe ne doit être annoncée sur la seule base des tests simulant les providers.
