-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 006.
-- Adds: an optional photo per child, and a profile (name + photo) per servant.
-- Photos are small JPEG thumbnails stored in the row itself (data:image/... text), so they work
-- offline and are protected by the same class rules as the rest of the child's data.

-- =====================================================================
-- 1) Child photo
-- =====================================================================
alter table khedma_2027.children
  add column if not exists photo text
  check (photo is null or (photo like 'data:image/%' and length(photo) < 400000));

-- =====================================================================
-- 2) Profiles — one per account
-- =====================================================================
create table if not exists khedma_2027.profiles (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (display_name is null or length(display_name) <= 100),
  photo        text check (photo is null or (photo like 'data:image/%' and length(photo) < 400000)),
  updated_at   timestamptz not null default now()
);

alter table khedma_2027.profiles enable row level security;
revoke all on khedma_2027.profiles from anon;

-- Colleagues can see each other's name and photo; only you can change yours.
drop policy if exists "servants read profiles" on khedma_2027.profiles;
drop policy if exists "own profile insert"     on khedma_2027.profiles;
drop policy if exists "own profile update"     on khedma_2027.profiles;
create policy "servants read profiles" on khedma_2027.profiles for select to authenticated using (true);
create policy "own profile insert"     on khedma_2027.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "own profile update"     on khedma_2027.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists profiles_touch_updated_at on khedma_2027.profiles;
create trigger profiles_touch_updated_at
  before update on khedma_2027.profiles
  for each row execute function khedma_2027.touch_updated_at();

-- =====================================================================
-- 3) Audit: log that a photo changed, but not the image itself (keeps the log small)
-- =====================================================================
create or replace function khedma_2027.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  v_row     jsonb;
  v_id      text;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_changed
    from jsonb_each(v_new) n
    where n.value is distinct from v_old -> n.key
      and n.key <> 'updated_at';
    if v_changed is null then return new; end if;
  end if;

  v_old := v_old - 'photo';
  v_new := v_new - 'photo';

  v_row := coalesce(v_new, v_old);
  v_id := case tg_table_name
    when 'follow_up'     then (v_row ->> 'child_client_id') || '@' || (v_row ->> 'date') || '@' || (v_row ->> 'kind')
    when 'custom_fields' then v_row ->> 'key'
    when 'classes'       then v_row ->> 'id'
    when 'class_members' then (v_row ->> 'class_id') || '@' || (v_row ->> 'user_id')
    when 'profiles'      then v_row ->> 'user_id'
    else v_row ->> 'client_id'
  end;

  insert into khedma_2027.audit_log (user_id, user_email, action, table_name, record_id, old_data, new_data, changed_fields)
  values (auth.uid(), auth.jwt() ->> 'email', lower(tg_op), tg_table_name, v_id, v_old, v_new, v_changed);

  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_profiles on khedma_2027.profiles;
create trigger audit_profiles
  after insert or update or delete on khedma_2027.profiles
  for each row execute function khedma_2027.audit_trigger();

-- =====================================================================
-- 4) Admin user list now shows each servant's name
-- =====================================================================
drop function if exists khedma_2027.admin_list_users();
create function khedma_2027.admin_list_users()
returns table (id uuid, email text, display_name text, created_at timestamptz, last_sign_in_at timestamptz, is_admin boolean, class_ids uuid[])
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
           coalesce(array_agg(m.class_id) filter (where m.class_id is not null), '{}')
    from auth.users u
    left join khedma_2027.profiles p on p.user_id = u.id
    left join khedma_2027.class_members m on m.user_id = u.id
    group by u.id, p.display_name
    order by u.created_at;
end;
$$;

revoke all on function khedma_2027.admin_list_users() from public, anon;
grant execute on function khedma_2027.admin_list_users() to authenticated;
