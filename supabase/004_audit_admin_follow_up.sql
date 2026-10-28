-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 002 and 003.
-- Adds: an audit log of every change, an admin role, and the متابعة table
-- (two ticks per child per Friday: الحضور and الافتقاد).

-- =====================================================================
-- 1) Admin role
--    A user is admin when auth.users.raw_app_meta_data has {"role":"admin"}.
--    app_metadata can only be changed from SQL / service role, never by the user.
-- =====================================================================
create or replace function khedma_2027.is_admin()
returns boolean
language sql
stable
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false) $$;

-- =====================================================================
-- 2) متابعة — per child, per Friday, per kind:
--    kind = 'attendance' (الحضور) or 'visit' (الافتقاد)
-- =====================================================================
create table if not exists khedma_2027.follow_up (
  child_client_id uuid not null references khedma_2027.children (client_id) on delete cascade,
  date            date not null,
  kind            text not null check (kind in ('attendance', 'visit')),
  checked         boolean not null default true,
  updated_at      timestamptz not null default now(),
  primary key (child_client_id, date, kind)
);

alter table khedma_2027.follow_up enable row level security;
revoke all on khedma_2027.follow_up from anon;

drop policy if exists "servants can read follow_up" on khedma_2027.follow_up;
drop policy if exists "servants can add follow_up" on khedma_2027.follow_up;
drop policy if exists "servants can edit follow_up" on khedma_2027.follow_up;

create policy "servants can read follow_up"
  on khedma_2027.follow_up for select to authenticated using (true);
create policy "servants can add follow_up"
  on khedma_2027.follow_up for insert to authenticated with check (true);
create policy "servants can edit follow_up"
  on khedma_2027.follow_up for update to authenticated using (true) with check (true);

drop trigger if exists follow_up_touch_updated_at on khedma_2027.follow_up;
create trigger follow_up_touch_updated_at
  before update on khedma_2027.follow_up
  for each row execute function khedma_2027.touch_updated_at();

-- =====================================================================
-- 3) Audit log — append-only
-- =====================================================================
create table if not exists khedma_2027.audit_log (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  user_id        uuid,
  user_email     text,          -- null = done from the Supabase dashboard / SQL editor
  action         text not null, -- insert | update | delete | login | logout
  table_name     text,
  record_id      text,
  old_data       jsonb,
  new_data       jsonb,
  changed_fields text[]
);

create index if not exists audit_log_at_idx on khedma_2027.audit_log (at desc);

alter table khedma_2027.audit_log enable row level security;
revoke all on khedma_2027.audit_log from anon, authenticated;
grant select on khedma_2027.audit_log to authenticated;

-- Only admins can read it. Nobody can insert/update/delete it directly (no policies for that);
-- rows are written only by the trigger and log_event() below.
drop policy if exists "admins can read audit" on khedma_2027.audit_log;
create policy "admins can read audit"
  on khedma_2027.audit_log for select to authenticated using (khedma_2027.is_admin());

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
    if v_changed is null then return new; end if; -- nothing real changed
  end if;

  v_row := coalesce(v_new, v_old);
  v_id := case tg_table_name
    when 'follow_up'     then (v_row ->> 'child_client_id') || '@' || (v_row ->> 'date') || '@' || (v_row ->> 'kind')
    when 'custom_fields' then v_row ->> 'key'
    else v_row ->> 'client_id'
  end;

  insert into khedma_2027.audit_log (user_id, user_email, action, table_name, record_id, old_data, new_data, changed_fields)
  values (auth.uid(), auth.jwt() ->> 'email', lower(tg_op), tg_table_name, v_id, v_old, v_new, v_changed);

  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_children on khedma_2027.children;
create trigger audit_children
  after insert or update or delete on khedma_2027.children
  for each row execute function khedma_2027.audit_trigger();

drop trigger if exists audit_custom_fields on khedma_2027.custom_fields;
create trigger audit_custom_fields
  after insert or update or delete on khedma_2027.custom_fields
  for each row execute function khedma_2027.audit_trigger();

drop trigger if exists audit_follow_up on khedma_2027.follow_up;
create trigger audit_follow_up
  after insert or update or delete on khedma_2027.follow_up
  for each row execute function khedma_2027.audit_trigger();

-- Sign-in / sign-out events, called by the app.
create or replace function khedma_2027.log_event(p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_action not in ('login', 'logout') then
    raise exception 'unknown audit action %', p_action;
  end if;
  insert into khedma_2027.audit_log (user_id, user_email, action)
  values (auth.uid(), auth.jwt() ->> 'email', p_action);
end;
$$;

revoke all on function khedma_2027.log_event(text) from public, anon;
grant execute on function khedma_2027.log_event(text) to authenticated;

-- =====================================================================
-- 4) First admin, from inside the app
--    While there is no admin at all, any signed-in user can press "make me admin" once.
--    After that this does nothing — more admins are made from the Users page.
--    Safe because sign-ups are disabled: only accounts you created can sign in.
-- =====================================================================
create or replace function khedma_2027.has_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from auth.users where raw_app_meta_data ->> 'role' = 'admin') $$;

create or replace function khedma_2027.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('khedma_2027.claim_first_admin')); -- two people pressing at once
  if khedma_2027.has_admin() then return false; end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  where id = auth.uid();

  insert into khedma_2027.audit_log (user_id, user_email, action, table_name, record_id, new_data)
  values (auth.uid(), auth.jwt() ->> 'email', 'user_update', 'users', auth.uid()::text, jsonb_build_object('admin', true, 'first_admin', true));
  return true;
end;
$$;

revoke all on function khedma_2027.has_admin() from public, anon;
revoke all on function khedma_2027.claim_first_admin() from public, anon;
grant execute on function khedma_2027.has_admin() to authenticated;
grant execute on function khedma_2027.claim_first_admin() to authenticated;
