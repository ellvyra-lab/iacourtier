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

- 44 tests Coach/OAuth/connexions réussis, dont mémoire conversationnelle 055A.
- 2 tests PostgreSQL PGlite réussis : conservation, unicité, clés étrangères propriétaire,
  défauts séparés, RLS et refus des rôles navigateur.
- TypeScript sans erreur.
- `npm run build` local : blocage Windows EPERM lors de la création de répertoires `.next`.
- Build Vercel du commit initial `1d0bc6507d17b956685c9a0396228cca3a45e190` : Ready.
- Production : accès Gmail et Calendar de `viasoniacourtier@gmail.com` réellement vérifié.
- Deuxième compte demandé : `sonia.bernier@remax-quebec.com`, déjà utilisateur test Google.
  Son authentification Google doit être terminée par l'utilisateur avant le test réel
  de coexistence, reconnexion et révocation. Ces parcours passent avec transport simulé.
- People API désactivée : activation soumise à acceptation des conditions Google.
  Contacts en lecture seule est optionnel; les comptes existants ne reçoivent aucune
  permission Contacts automatiquement.
- Aucun courriel envoyé pendant la vérification. Les aperçus approuvés restent liés
  à un compte précis; une reconnexion ou déconnexion annule ses aperçus en attente.

## URL

https://iacourtier-44za.vercel.app/tableau-de-bord/reglages/connexions

Après la deuxième connexion : vérifier chaque accès; choisir un défaut Calendar
distinct du défaut Courriels; demander au Coach les courriels et les rendez-vous;
vérifier la provenance puis rafraîchir. Reconnecter le deuxième compte doit conserver
son ID et ne créer aucun doublon. Sa déconnexion doit laisser le premier fonctionnel.
