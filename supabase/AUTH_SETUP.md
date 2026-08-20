# Authentification IACourtier

## Configuration obligatoire

Dans chaque projet Vercel qui sert IACourtier, ajouter pour Production, Preview et Development :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (serveur seulement; ne jamais utiliser le préfixe `NEXT_PUBLIC_`)

Les deux premières valeurs se trouvent dans Supabase, **Project Settings → API**. Après leur ajout, relancer un déploiement Vercel : les variables publiques Next.js sont intégrées au build.

Dans Supabase, **Authentication → URL Configuration** :

- définir le Site URL sur le domaine public IACourtier;
- autoriser `https://<domaine>/auth/callback` dans les Redirect URLs;
- ajouter aussi les domaines Preview réellement utilisés pour les tests.

Exécuter ensuite [`schema.sql`](./schema.sql) dans le SQL Editor. Le trigger `on_auth_user_created` crée automatiquement une ligne `public.profiles` pour chaque vrai compte `auth.users`.

## Premier compte

1. Ouvrir `/inscription`.
2. Saisir le nom, le courriel et le mot de passe.
3. Si la confirmation par courriel est activée, ouvrir le lien reçu. Il passe par `/auth/callback` et crée la session cookie.
4. Compléter `/tableau-de-bord/bienvenue` pour enregistrer l’identité professionnelle.
5. L’accueil privé devient alors accessible.

## Attribuer le rôle `super_admin`

Le rôle privilégié vient uniquement de `auth.users.raw_app_meta_data`, jamais de `user_metadata` ni du navigateur. Exécuter [`promote_super_admin.sql`](./promote_super_admin.sql) dans le SQL Editor après avoir remplacé le courriel. L’utilisateur doit ensuite se déconnecter et se reconnecter pour recevoir un jeton contenant le nouveau rôle.

