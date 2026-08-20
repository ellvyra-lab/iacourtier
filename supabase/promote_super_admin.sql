-- À exécuter manuellement dans Supabase SQL Editor par la propriétaire du projet.
-- Remplacer l'adresse ci-dessous. Le bloc échoue volontairement si le compte
-- Supabase Auth n'existe pas encore ou si le placeholder n'a pas été remplacé.

do $$
declare
  owner_email constant text := 'REMPLACER_PAR_LE_COURRIEL_PROPRIETAIRE';
  affected integer;
begin
  if owner_email = 'REMPLACER_PAR_LE_COURRIEL_PROPRIETAIRE' then
    raise exception 'Remplacez owner_email par le courriel du vrai compte propriétaire.';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'super_admin')
  where lower(email) = lower(owner_email);

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Compte introuvable ou non unique pour %', owner_email;
  end if;
end
$$;
