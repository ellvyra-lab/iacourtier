# Ticket 055B — plusieurs comptes Google par courtier

## Cause corrigée

`connected_accounts` imposait `unique(user_id, provider)` et le retour OAuth supprimait
le compte précédent. Le nouveau compte remplaçait ses tokens et supprimait par cascade
les références associées. La nouvelle contrainte identifie `(user_id, provider, provider_subject)`.
Une reconnexion met à jour cette identité et conserve son ID. Une reconnexion ciblée
avec une autre identité Google est refusée.

## Migration

`supabase/migrations/202610141055_multiple_connected_accounts.sql` appliquée sans erreur
le 14 octobre 2026 au projet `yvgxipnfpylrktjyyjts`.
Les IDs et tokens chiffrés existants restent inchangés. Le chiffrement historique
reste lisible; les nouvelles autorisations sont liées au propriétaire ET à l'identité Google.
Les dates initiales absentes de l'ancien schéma restent explicitement inconnues.
La table privée `connected_account_defaults` conserve un défaut par utilisateur et service.
RLS activé; `anon` et `authenticated` n'ont aucun accès SQL au coffre.
Les routes serveur authentifiées vérifient le propriétaire avant chaque opération.

## Vérification

- 47 tests Coach/OAuth/connexions/transport People réussis, dont mémoire conversationnelle 055A.
- 2 tests PostgreSQL PGlite réussis : conservation, unicité, clés étrangères propriétaire,
  défauts séparés, RLS et refus des rôles navigateur.
- TypeScript sans erreur.
- `npm run build` local : blocage Windows EPERM lors de la création de répertoires `.next`.
- Build Vercel du code `21eaaec8157abe6c6f684e5bb458ad9c3e7b308c` : Ready, production.
- Production : Gmail et Calendar réellement vérifiés pour `viasoniacourtier@gmail.com`
  et `sonia.bernier@remax-quebec.com`, après consentement Google officiel.
- Révocation Remax réussie : compte déconnecté et autorisation Google révoquée.
  L'accès réel Gmail/Calendar du premier compte fonctionne toujours après cette révocation.
- Reconnexion Remax réussie : identifiant du compte conservé, date de reconnexion visible,
  nouvel accès Gmail/Calendar vérifié. SQL confirme 2 comptes, 2 identités, 2 comptes connectés.
- Défauts par service testés : Courriels sur le premier compte, Calendar sur Remax;
  choix conservé après rafraîchissement. Le Coach prépare un aperçu de rendez-vous
  sur Remax sans demander de compte. Aperçu annulé sans création d'événement.
  Le défaut Calendar initial sur le premier compte est rétabli après le test.
- Coach : lecture des 2 calendriers (1 rendez-vous trouvé) et recherche Gmail sur les
  2 comptes (40 résultats, 20 par compte). La provenance apparaît dans chaque carte.
- Comptes et conversation persistants après rafraîchissement. Aucun doublon de connexion.
- People API activée dans Google Cloud après accord sur les conditions Google.
  Contacts en lecture seule reste optionnel; aucune permission Contacts n'a été ajoutée
  aux deux comptes. Le transport People est testé automatiquement, pas avec ces comptes.
- Isolation entre courtiers : tests de propriétaires différents, clés étrangères et refus
  des rôles navigateur validés. Pas de connexion réelle à un deuxième compte IACourtier.
- Aucun courriel envoyé pendant la vérification. Les aperçus approuvés restent liés
  à un compte précis; une reconnexion ou déconnexion annule ses aperçus en attente.

## URL

https://iacourtier-44za.vercel.app/tableau-de-bord/reglages/connexions

Pour reproduire : vérifier chaque accès; choisir un défaut Calendar distinct du défaut
Courriels; demander au Coach les courriels et les rendez-vous; vérifier la provenance
puis rafraîchir. Une reconnexion conserve l'identité; une déconnexion laisse l'autre
compte fonctionnel. Les deux comptes sont laissés connectés à la fin de la vérification.
