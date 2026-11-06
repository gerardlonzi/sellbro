-- ============================================================
-- Supprimer un utilisateur (Dashboard Supabase → Authentication → Users)
-- SANS perdre son essai gratuit.
--
-- Problème : essais_gratuits.user_id référence auth.users sans ON DELETE →
-- la suppression est bloquée par cette clé étrangère (et par d'autres tables
-- configurées « NO ACTION »).
-- Solution :
--  1) l'essai garde l'EMAIL du compte : même supprimé puis recréé avec le même
--     email, la personne retrouve le MÊME essai (donc pas de réessai gratuit) ;
--  2) essais_gratuits.user_id passe en ON DELETE SET NULL : la ligne reste ;
--  3) toute autre clé étrangère vers auth.users qui bloque devient
--     CASCADE (ou SET NULL si la colonne l'accepte).
-- À exécuter UNE fois dans le SQL Editor.
-- ============================================================

-- 1) Email mémorisé dans l'essai.
alter table essais_gratuits add column if not exists email text;
update essais_gratuits e set email = lower(u.email)
  from auth.users u where e.user_id = u.id and e.email is null;
create index if not exists essais_gratuits_email_idx on essais_gratuits (lower(email));

-- 2) user_id : l'essai survit à la suppression de l'utilisateur.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.essais_gratuits'::regclass and contype = 'f'
      and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.essais_gratuits drop constraint %I', c.conname);
  end loop;
  alter table public.essais_gratuits alter column user_id drop not null;
  alter table public.essais_gratuits
    add constraint essais_gratuits_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
end $$;

-- 3) Les autres clés étrangères vers auth.users qui bloquent la suppression.
do $$
declare c record; action text;
begin
  for c in
    select con.conrelid::regclass as tbl, con.conname, a.attname, a.attnotnull
    from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where con.contype = 'f' and con.confrelid = 'auth.users'::regclass
      and con.confdeltype in ('a', 'r')            -- NO ACTION / RESTRICT
      and array_length(con.conkey, 1) = 1
      and con.conrelid <> 'public.essais_gratuits'::regclass
  loop
    action := case when c.attnotnull then 'cascade' else 'set null' end;
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete %s',
                   c.tbl, c.conname, c.attname, action);
    raise notice 'FK % sur % : ON DELETE %', c.conname, c.tbl, upper(action);
  end loop;
end $$;

-- 4) Démarrage de l'essai : retrouve l'essai par user_id, SINON par email
--    (compte supprimé puis recréé) et le rattache au nouveau compte.
create or replace function demarrer_essai_user(p_user_id uuid)
returns table (date_debut timestamptz, date_fin timestamptz, jours_restants integer)
language plpgsql security definer set search_path = public as $$
declare
  duree integer;
  debut timestamptz;
  fin timestamptz;
  mail text;
  ligne uuid;
begin
  -- L'appelant ne peut démarrer que SON essai.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'non autorisé';
  end if;

  select lower(email) into mail from auth.users where id = p_user_id;

  select id, essais_gratuits.date_debut, essais_gratuits.date_fin into ligne, debut, fin
    from essais_gratuits where user_id = p_user_id;

  if ligne is null and mail is not null then
    select id, essais_gratuits.date_debut, essais_gratuits.date_fin into ligne, debut, fin
      from essais_gratuits where lower(email) = mail order by essais_gratuits.date_debut limit 1;
    if ligne is not null then
      -- Même personne (même email) : on rattache l'ancien essai au nouveau compte.
      update essais_gratuits set user_id = p_user_id where id = ligne and user_id is null;
    end if;
  end if;

  if fin is null then
    select coalesce((select valeur::integer from app_config where cle = 'duree_essai_jours'), 3) into duree;
    debut := now();
    fin := debut + (duree * interval '1 day');
    insert into essais_gratuits (user_id, identifiant_appareil, date_debut, date_fin, email)
      values (p_user_id, p_user_id::text, debut, fin, mail)
      on conflict (user_id) do nothing;
  end if;

  return query select debut, fin,
    greatest(0, ceil(extract(epoch from (fin - now())) / 86400)::integer);
end;
$$;
