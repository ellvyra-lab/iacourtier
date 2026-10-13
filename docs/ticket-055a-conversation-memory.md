# Ticket 055A — mémoire conversationnelle

Cause : `coach_conversations.pending` ne conservait que les choix de contacts/dossiers. Les questions libres (heure, titre) étaient des exceptions ordinaires : l'action initiale était perdue et la réponse suivante repassait dans le modèle. Les dates relatives et le fuseau n'étaient pas fixés dans l'action.

Correction : réutilisation du JSON `pending` existant, lié par les requêtes serveur à l'utilisateur authentifié et à la conversation. L'action validée, le texte original, les sélections, le fuseau et la date absolue sont persistés. Une heure seule reprend cette action sans reconstruire son titre avec le modèle. Les corrections d'heure/date/titre remplacent l'aperçu ; annulation ou nouveau sujet effacent l'action en attente. Un calendrier absent ou une erreur de préparation conserve l'action pour reprise explicite.

Les créations utilisent les providers Calendar existants, les aperçus `connected_actions`, leur confirmation et leur verrou de tentative unique. Aucun nouveau calendrier, système CRM ou interface. Les dates suivent le fuseau du navigateur validé côté serveur et refusent les heures ambiguës/inexistantes lors des changements d'heure.

Tests locaux : 37 tests réussis (moteur conversationnel, calendrier/providers, tâches), dont reprise après relecture de la base, correction d'aperçu, annulation, calendrier absent, conflit de créneau, contexte de courriel, dates/fuseaux, isolation utilisateur/conversation et confirmation sans double appel.

Validation réelle du 12 octobre 2026 : la phrase exacte a produit « À quelle heure ? ». Après rafraîchissement, « 11 h » a repris le titre intégral et la date du 13 octobre. Corrections réelles à 14 h puis retour à 11 h : anciens aperçus annulés. Confirmation : événement créé dans Google Calendar de viasoniacourtier@gmail.com, puis relu depuis le provider avec le titre « Vérifier le rendez-vous avec la maman de Francis », le 13 octobre à 11 h–12 h, America/Toronto. Supabase confirme une seule action terminée et deux aperçus annulés dans la conversation `a528e241-70f0-4102-b73d-5ad5fb8a3160`. Référence événement IACourtier : `b6432f6e-877e-438a-b6e1-971115a0f142`. Annulation libre également testée en production, sans création externe.

Changement de sujet également testé réellement : nouvelle demande → question d'heure → « Montre mon agenda aujourd'hui ». Supabase confirme `pending IS NULL` et toujours une seule action terminée. Les tests de calendrier absent et de fuseau différent sont locaux, sans déconnecter le calendrier réel de l'utilisateur.

TypeScript validé. `npm run build` a été exécuté localement mais Windows refuse certains mkdir dans `.next` (`EPERM`). Le build Vercel du premier correctif est confirmé READY sur le commit `ff9e71cae91621f19b8ae8ba5de04f40c21123d7` ; les protections supplémentaires de reprise après conflit sont couvertes par les tests. Aucun changement de schéma Supabase.
