# Coach — quantité et ordre des courriels

## Problème reproduit

La demande « les cinq derniers courriels reçus » affichait 35 résultats. Le gestionnaire appelait chaque compte avec une limite fixe de 20, concaténait les réponses sans tri global et ne conservait pas le nombre demandé. Les cartes pouvaient aussi inclure des messages envoyés. Le texte annonçait systématiquement 30 jours, même quand le chemin `get_recent_emails` utilisait seulement 24 heures.

## Correction

Le routeur existant conserve `values.limit`, `values.latest` et `values.receivedOnly`. Une normalisation valide ces paramètres et reprend la quantité explicite du message courant, en chiffres ou dans les formulations françaises usuelles. Il ne s'agit pas d'une réponse spéciale au mot « cinq ». Une durée comme « depuis 5 jours » n'est pas interprétée comme une quantité de messages.

Les comptes autorisés sont interrogés séparément, puis les résultats sont classés ensemble selon l'instant réel de réception. La limite s'applique au résultat combiné. Chaque carte conserve le compte source, l'expéditeur, l'objet et la date. Les doublons d'un même compte sont éliminés; un même identifiant distant sur deux comptes reste distingué.

« Reçus » exclut les messages envoyés. La recherche des derniers messages ne reçoit plus de filtre temporel implicite de 30 jours. Une recherche classique conserve sa fenêtre existante; les recherches récentes ordinaires conservent leur fenêtre de 24 heures. Le plafond fournisseur existant de 30 est conservé et annoncé pour les demandes supérieures. Les erreurs de comptes et les dates inexploitables sont signalées comme résultats partiels. Si moins de cinq courriels peuvent être vérifiés, aucune ligne manquante n'est inventée.

Les références ne sont créées que pour les cartes effectivement sélectionnées. Aucun envoi, brouillon Gmail, changement de statut lu/non lu, jeton, clé ou migration n'est ajouté par cette correction. Les contrôles d'appartenance et les comptes nommés existants sont conservés. La bêta n'est pas utilisée.

## Tests

Le fichier `scripts/coach-email-list.test.mjs` ajoute sept tests couvrant : quantités naturelles et paramètres invalides; cinq résultats multicomptes et tri par fuseau horaire; comptes nommés, erreurs et dates absentes; identifiants identiques entre comptes et plafond; normalisation du routeur existant; requêtes Gmail et Microsoft sans modification de message. Les jeux de données sont synthétiques et aucun appel modèle n'est effectué par ces tests.

La suite de publication passe de 158 à 165 tests. La validation du build et la recette de production doivent être consignées séparément; les tests fournisseur avec fixtures ne sont pas présentés comme une nouvelle connexion Microsoft réelle.

## Références fournisseur

- [Recherche et filtrage Gmail](https://developers.google.com/workspace/gmail/api/guides/filtering)
- [Liste des messages Microsoft Graph](https://learn.microsoft.com/graph/api/user-list-messages)

Les paramètres de filtre et de tri suivent les interfaces existantes des fournisseurs. L'envoi de courriels n'est pas modifié.

Validation locale du 21 octobre 2026 : 165 tests réussis, zéro échec et zéro test ignoré. npm run build terminé avec code 0, lint et TypeScript strict actifs. L'adaptation locale Windows de sortie de build est retirée avant commit; aucune configuration de production ni dépendance modifiée. Aucun appel IA supplémentaire pendant le diagnostic et les tests locaux. La recette de production est consignée dans les preuves externes au dépôt après publication.
