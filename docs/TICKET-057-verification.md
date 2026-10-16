# Ticket 057 — identité professionnelle et mémoire des courriels

Vérification du 16 octobre 2026. Code livré sur main : `0892a5e1d5b633fb53f0b2b6584950c31e7d0c5d`.

## Causes

La préparation de courriel ne chargeait pas le profil professionnel. Le modèle ne recevait pas une séparation complète entre courtier, correspondant et fil original. Les retouches repassaient par le routage général et pouvaient annuler l'action courante. La signature et le compte expéditeur n'étaient pas des champs indépendants du brouillon.

## Corrections

- Chargement serveur du profil existant, filtré par utilisateur authentifié; signature issue des données enregistrées, sans coordonnées inventées.
- Conservation du message original, de son compte, du fil et du brouillon dans les structures de conversation/actions existantes. Aucun nouveau schéma ni migration.
- Routage déterministe des retouches, de la préparation sans envoi et du changement de compte. Nouvelle version durable avant invalidation de l'ancienne; refus des confirmations périmées.
- Destinataire, objet, message, signature et compte expéditeur éditables. Les réponses excluent les propres comptes du courtier. Un changement de compte conserve les références RFC sans réutiliser un thread Gmail appartenant à l'autre boîte.
- Proposition séparée et confirmation explicite avant enregistrement d'une nouvelle coordonnée dans le profil; contrôle de concurrence. Aucune modification de fiche client.
- Envoi après confirmation finale seulement; succès après retour fournisseur réel, erreur ou état incertain sinon. Aucun renvoi automatique après résultat ambigu.

## Fichiers

- `src/lib/server/coach-professional-context.ts`
- `src/lib/server/connections/coach-connected.ts`
- `src/lib/server/connections/providers.ts`
- `src/lib/server/process-coach-message.ts`
- `src/lib/server/coach-intent.ts`
- `src/lib/coach/conversation.ts`
- `src/components/coach-conversation.tsx`
- `scripts/coach-professional-email.test.mjs`
- `scripts/coach-professional-email-live.mjs`
- `scripts/coach-conversation.test.mjs`
- `scripts/connected-assistant.test.mjs`
- Ce rapport.

## Tests exécutés

145 tests locaux réussis, zéro échec : régressions Coach, actions connectées, OAuth, CRM et contrôles SQL/PGlite. Les 12 scénarios professionnels couvrent identité/destinataire, retouches persistantes, signature actualisée, comptes, isolation utilisateur/conversation, confirmation unique, propositions de profil, erreurs fournisseur et refus de coordonnées inventées. TypeScript sans émission réussi.

Test opt-in `RUN_EMAIL_LIVE=1 node scripts/coach-professional-email-live.mjs` réussi avec deux véritables appels OpenAI, modèle configuré `gpt-4o-mini`. Ce script utilise des données synthétiques et un fournisseur Gmail simulé : ce résultat ne prouve pas un envoi Gmail réel.

En production, avec la session disponible :

- Lecture réelle de Gmail : 28 résultats avec provenance sur les deux comptes Google connectés.
- Sélection d'un courriel professionnel entrant et génération réelle d'une réponse. Destinataire = correspondant original; identité et signature = profil du courtier.
- « Ajoute mon téléphone » conserve le destinataire, l'objet et le texte; téléphone enregistré présent dans la signature.
- Rafraîchissement : historique et brouillon conservés, ancien aperçu non actionnable.
- Retouche chaleureuse/courte : destinataire et objet conservés, texte modifié dans le même contexte.
- « Utilise mon autre courriel » passe du compte Remax à l'autre Gmail sans changer le destinataire.
- Modification temporaire de la signature par un marqueur de test : le brouillon suivant reprend la nouvelle version. Signature originale restaurée et relue après enregistrement.
- « Parfait, prépare-le pour l'envoi » laisse un aperçu demandant confirmation; aucun envoi effectué pendant les essais.

## Build et déploiement

`npm run build` exécuté deux fois localement : blocage Windows `EPERM` lors de la création de sous-dossiers `.next/server/app` (routes différentes), sans erreur TypeScript identifiée. Ne pas présenter ces exécutions comme réussies.

Le build Vercel du commit exact `0892a5e` est réussi, déploiement **Ready / Production**, durée 2 min 18 s :
https://vercel.com/ellvyra-6684s-projects/iacourtier-44za/F1cSX56b1waY5MMe46dSeEKzZuQa

## Limites constatées

Le premier texte réel contenait une formule de suivi non demandée malgré la consigne sans engagement. Une retouche explicite l'a supprimée. Les consignes du modèle ne garantissent donc pas à elles seules l'absence de toute formulation indésirable : le texte final reste soumis à vérification et confirmation humaine.

L'isolation entre deux courtiers est testée automatiquement, mais aucune seconde session réelle de courtier distinct n'a été utilisée. Deux comptes Google du même courtier ne constituent pas ce test. Aucun envoi réel à un client n'a été déclenché; le retour de Gmail après envoi est couvert par les régressions fournisseur, pas par un envoi de production pendant cette vérification. Les brouillons préparatoires sont persistés dans IACourtier; la création du brouillon natif Gmail intervient lors de l'exécution finale confirmée.

Aucune modification de clés, de données CRM, de migration ou de configuration bêta. Le flux main existant déploie la production; aucune bêta n'a été publiée.

## URL et essai simple

https://iacourtier-44za.vercel.app/tableau-de-bord/coach

1. Demander les courriels récents et sélectionner un courriel entrant.
2. Demander de préparer une réponse; vérifier destinataire, identité, signature et compte.
3. Demander « Ajoute mon téléphone », puis « Rends ça plus chaleureux »; rafraîchir et vérifier le même contexte.
4. Demander « Utilise mon autre courriel », puis « Parfait, prépare-le pour l'envoi ». Vérifier l'aperçu final; ne cliquer sur Envoyer qu'après validation réelle du texte.
