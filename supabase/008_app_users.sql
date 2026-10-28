-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 007.
--
-- Sign-in accounts (auth.users) are shared by every app in this Supabase project
-- (e.g. bishoy-saber-notes). This keeps a list of Khedma's own accounts:
--   • only accounts on the list can use the Khedma app, and only they appear on its Users page;
--   • an account joins the list when it signs up from the Khedma app, or when a Khedma admin
--     creates it — accounts made by other apps never do.

-- =====================================================================
-- 1) The list
-- =====================================================================
create table if not exists khedma_2027.app_users (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table khedma_2027.app_users enable row level security;
revoke all on khedma_2027.app_users from anon, authenticated;

-- Everyone who can already see Khedma data stays: class members and Khedma admins.
insert into khedma_2027.app_users (user_id)
select distinct m.user_id from khedma_2027.class_members m
on conflict do nothing;

insert into khedma_2027.app_users (user_id)
select id from auth.users where raw_app_meta_data ->> 'role' = 'admin'
on conflict do nothing;

-- =====================================================================
-- 2) Sign-ups from the Khedma app join the list by themselves
--    (the app sends user_metadata.app = 'khedma_2027' when it signs someone up)
-- =====================================================================
create or replace function khedma_2027.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'app' = 'khedma_2027' then
    insert into khedma_2027.app_users (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists khedma_2027_on_auth_user_created on auth.users;
create trigger khedma_2027_on_auth_user_created
  after insert on auth.users
  for each row execute function khedma_2027.on_auth_user_created();

-- =====================================================================
-- 3) Checks
-- =====================================================================
create or replace function khedma_2027.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from khedma_2027.app_users where user_id = auth.uid()) $$;

revoke all on function khedma_2027.is_app_user() from public, anon;
grant execute on function khedma_2027.is_app_user() to authenticated;

-- Used by the khedma-admin-users Edge Function: an account that is ALSO used by
-- bishoy-saber-notes must never be deleted or have its email / password changed from Khedma.
create or replace function khedma_2027.is_shared_account(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if to_regclass('bishoy_saber_notes.users') is null then return false; end if;
  return exists (select 1 from bishoy_saber_notes.users b where b.auth_id = p_user);
end;
$$;

revoke all on function khedma_2027.is_shared_account(uuid) from public, anon, authenticated;
grant execute on function khedma_2027.is_shared_account(uuid) to service_role;

-- Accounts outside the list can't create or join classes, so they can never reach any data.
create or replace function khedma_2027.create_class(p_name text, p_year text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not khedma_2027.is_app_user() then raise exception 'not a Khedma account'; end if;
  insert into khedma_2027.classes (name, service_year, created_by)
  values (trim(p_name), coalesce(p_year, khedma_2027.current_service_year()), auth.uid())
  returning id into v_id;
  insert into khedma_2027.class_members (class_id, user_id) values (v_id, auth.uid());
  return v_id;
end;
$$;

create or replace function khedma_2027.join_class(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite khedma_2027.class_invites;
begin
  if not khedma_2027.is_app_user() then raise exception 'not a Khedma account'; end if;
  if (select count(*) from khedma_2027.join_failures f where f.user_id = auth.uid() and f.at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'too_many');
  end if;

  select * into v_invite from khedma_2027.class_invites i
  where i.code = trim(p_code) and i.used_at is null and i.expires_at > now()
  for update;

  if not found then
    insert into khedma_2027.join_failures (user_id) values (auth.uid());
    return jsonb_build_object('error', 'invalid');
  end if;

  insert into khedma_2027.class_members (class_id, user_id) values (v_invite.class_id, auth.uid()) on conflict do nothing;
  update khedma_2027.class_invites set used_by = auth.uid(), used_at = now() where code = v_invite.code;
  return jsonb_build_object('class_id', v_invite.class_id);
end;
$$;

-- =====================================================================
-- 4) Users page: Khedma's accounts only
-- =====================================================================
drop function if exists khedma_2027.admin_list_users();
create function khedma_2027.admin_list_users()
returns table (
  id uuid, email text, display_name text, created_at timestamptz, last_sign_in_at timestamptz,
  is_admin boolean, shared boolean, class_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not khedma_2027.is_admin() then raise exception 'admins only'; end if;
  return query
    select u.id, u.email::text, p.display_name, u.created_at, u.last_sign_in_at,
           coalesce(u.raw_app_meta_data ->> 'role' = 'admin', false),
           khedma_2027.is_shared_account(u.id),
           coalesce(array_agg(m.class_id) filter (where m.class_id is not null), '{}')
    from khedma_2027.app_users a
    join auth.users u on u.id = a.user_id
    left join khedma_2027.profiles p on p.user_id = u.id
    left join khedma_2027.class_members m on m.user_id = u.id
    group by u.id, p.display_name
    order by u.created_at;
end;
$$;

revoke all on function khedma_2027.admin_list_users() from public, anon;
grant execute on function khedma_2027.admin_list_users() to authenticated;

-- Check: Khedma's accounts
-- select u.email from khedma_2027.app_users a join auth.users u on u.id = a.user_id order by u.email;
