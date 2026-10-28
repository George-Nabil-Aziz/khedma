-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 002, 003 and 004.
-- Adds classes (فصول): every child belongs to one class, servants only see the classes they
-- are members of, and a one-time 6-digit code (valid 15 minutes) lets a servant invite a colleague.
--
-- ⚠️ BEFORE RUNNING: put the name of your current class on the line marked "CLASS NAME" below.

-- =====================================================================
-- 0) Service year
--    Ends on the first Friday AFTER 6 October (6 Oct and that Friday still belong to the
--    old year). E.g. 2026-2027 runs from Sat 10 Oct 2026 to Fri 8 Oct 2027.
-- =====================================================================
create or replace function khedma_2027.service_year_end(p_year int)
returns date
language sql
immutable
as $$
  select make_date(p_year, 10, 6)
       + coalesce(nullif((5 - extract(dow from make_date(p_year, 10, 6))::int + 7) % 7, 0), 7)
$$;

create or replace function khedma_2027.current_service_year()
returns text
language sql
stable
as $$
  with t as (select (now() at time zone 'Africa/Cairo')::date as d)
  select case
    when t.d > khedma_2027.service_year_end(extract(year from t.d)::int)
      then extract(year from t.d)::int || '-' || (extract(year from t.d)::int + 1)
    else (extract(year from t.d)::int - 1) || '-' || extract(year from t.d)::int
  end
  from t
$$;

-- =====================================================================
-- 1) Tables
-- =====================================================================
create table if not exists khedma_2027.classes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  service_year text not null default khedma_2027.current_service_year() check (service_year ~ '^\d{4}-\d{4}$'),
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

create table if not exists khedma_2027.class_members (
  class_id   uuid not null references khedma_2027.classes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  -- ⭐ "this year's class" — opens automatically. At most one per user.
  is_default boolean not null default false,
  primary key (class_id, user_id)
);

create unique index if not exists class_members_one_default
  on khedma_2027.class_members (user_id) where is_default;

-- One-time codes: valid 15 minutes, dead after the first use.
create table if not exists khedma_2027.class_invites (
  code       text primary key,
  class_id   uuid not null references khedma_2027.classes (id) on delete cascade,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_by    uuid,
  used_at    timestamptz
);

-- Failed code attempts, to stop someone guessing codes.
create table if not exists khedma_2027.join_failures (
  user_id uuid not null,
  at      timestamptz not null default now()
);

alter table khedma_2027.children      add column if not exists class_id uuid references khedma_2027.classes (id) on delete restrict;
alter table khedma_2027.custom_fields add column if not exists class_id uuid references khedma_2027.classes (id) on delete cascade;

create index if not exists children_class_id_idx on khedma_2027.children (class_id);
create index if not exists class_members_user_idx on khedma_2027.class_members (user_id);

-- =====================================================================
-- 2) Existing data → one class, and everyone who can see it today stays in it
-- =====================================================================
do $$
declare
  v_class uuid;
begin
  if not exists (select 1 from khedma_2027.classes) then
    insert into khedma_2027.classes (name)
    values ('اكتب اسم الفصل هنا')  -- ← CLASS NAME
    returning id into v_class;

    update khedma_2027.children      set class_id = v_class where class_id is null;
    update khedma_2027.custom_fields set class_id = v_class where class_id is null;

    insert into khedma_2027.class_members (class_id, user_id, is_default)
    select v_class, id, true from auth.users
    on conflict do nothing;
  end if;
end;
$$;

alter table khedma_2027.children      alter column class_id set not null;
alter table khedma_2027.custom_fields alter column class_id set not null;

-- =====================================================================
-- 3) Who can see what
-- =====================================================================
create or replace function khedma_2027.is_member(p_class uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select khedma_2027.is_admin()
      or exists (select 1 from khedma_2027.class_members m where m.class_id = p_class and m.user_id = auth.uid())
$$;

create or replace function khedma_2027.can_see_child(p_child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from khedma_2027.children c where c.client_id = p_child and khedma_2027.is_member(c.class_id))
$$;

-- children: replace "every servant" with "members of the child's class"
drop policy if exists "servants can read children"   on khedma_2027.children;
drop policy if exists "servants can add children"    on khedma_2027.children;
drop policy if exists "servants can edit children"   on khedma_2027.children;
drop policy if exists "servants can delete children" on khedma_2027.children;
drop policy if exists "members read children"   on khedma_2027.children;
drop policy if exists "members add children"    on khedma_2027.children;
drop policy if exists "members edit children"   on khedma_2027.children;
drop policy if exists "members delete children" on khedma_2027.children;

create policy "members read children"   on khedma_2027.children for select to authenticated using (khedma_2027.is_member(class_id));
create policy "members add children"    on khedma_2027.children for insert to authenticated with check (khedma_2027.is_member(class_id));
create policy "members edit children"   on khedma_2027.children for update to authenticated using (khedma_2027.is_member(class_id)) with check (khedma_2027.is_member(class_id));
create policy "members delete children" on khedma_2027.children for delete to authenticated using (khedma_2027.is_member(class_id));

-- follow_up: through the child's class
drop policy if exists "servants can read follow_up" on khedma_2027.follow_up;
drop policy if exists "servants can add follow_up"  on khedma_2027.follow_up;
drop policy if exists "servants can edit follow_up" on khedma_2027.follow_up;
drop policy if exists "members read follow_up" on khedma_2027.follow_up;
drop policy if exists "members add follow_up"  on khedma_2027.follow_up;
drop policy if exists "members edit follow_up" on khedma_2027.follow_up;

create policy "members read follow_up" on khedma_2027.follow_up for select to authenticated using (khedma_2027.can_see_child(child_client_id));
create policy "members add follow_up"  on khedma_2027.follow_up for insert to authenticated with check (khedma_2027.can_see_child(child_client_id));
create policy "members edit follow_up" on khedma_2027.follow_up for update to authenticated using (khedma_2027.can_see_child(child_client_id)) with check (khedma_2027.can_see_child(child_client_id));

-- custom columns: per class
drop policy if exists "servants can read fields"   on khedma_2027.custom_fields;
drop policy if exists "servants can add fields"    on khedma_2027.custom_fields;
drop policy if exists "servants can edit fields"   on khedma_2027.custom_fields;
drop policy if exists "servants can delete fields" on khedma_2027.custom_fields;
drop policy if exists "members read fields"   on khedma_2027.custom_fields;
drop policy if exists "members add fields"    on khedma_2027.custom_fields;
drop policy if exists "members edit fields"   on khedma_2027.custom_fields;
drop policy if exists "members delete fields" on khedma_2027.custom_fields;

create policy "members read fields"   on khedma_2027.custom_fields for select to authenticated using (khedma_2027.is_member(class_id));
create policy "members add fields"    on khedma_2027.custom_fields for insert to authenticated with check (khedma_2027.is_member(class_id));
create policy "members edit fields"   on khedma_2027.custom_fields for update to authenticated using (khedma_2027.is_member(class_id)) with check (khedma_2027.is_member(class_id));
create policy "members delete fields" on khedma_2027.custom_fields for delete to authenticated using (khedma_2027.is_member(class_id));

-- classes: see / rename your classes; only admins delete. Created through create_class().
alter table khedma_2027.classes enable row level security;
revoke all on khedma_2027.classes from anon;
drop policy if exists "members read classes"   on khedma_2027.classes;
drop policy if exists "members rename classes" on khedma_2027.classes;
drop policy if exists "admins delete classes"  on khedma_2027.classes;
create policy "members read classes"   on khedma_2027.classes for select to authenticated using (khedma_2027.is_member(id));
create policy "members rename classes" on khedma_2027.classes for update to authenticated using (khedma_2027.is_member(id)) with check (khedma_2027.is_member(id));
create policy "admins delete classes"  on khedma_2027.classes for delete to authenticated using (khedma_2027.is_admin());

-- class_members: see colleagues; leave yourself; admins add / remove anyone.
alter table khedma_2027.class_members enable row level security;
revoke all on khedma_2027.class_members from anon;
drop policy if exists "members read members" on khedma_2027.class_members;
drop policy if exists "admins add members"   on khedma_2027.class_members;
drop policy if exists "leave or admin remove" on khedma_2027.class_members;
create policy "members read members"  on khedma_2027.class_members for select to authenticated using (khedma_2027.is_member(class_id));
create policy "admins add members"    on khedma_2027.class_members for insert to authenticated with check (khedma_2027.is_admin());
create policy "leave or admin remove" on khedma_2027.class_members for delete to authenticated using (user_id = auth.uid() or khedma_2027.is_admin());

-- invites and failures: only through the functions below
alter table khedma_2027.class_invites enable row level security;
alter table khedma_2027.join_failures enable row level security;
revoke all on khedma_2027.class_invites from anon, authenticated;
revoke all on khedma_2027.join_failures from anon, authenticated;

-- =====================================================================
-- 4) Functions the app calls
-- =====================================================================
drop function if exists khedma_2027.create_class(text);
create or replace function khedma_2027.create_class(p_name text, p_year text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into khedma_2027.classes (name, service_year, created_by)
  values (trim(p_name), coalesce(p_year, khedma_2027.current_service_year()), auth.uid())
  returning id into v_id;
  insert into khedma_2027.class_members (class_id, user_id) values (v_id, auth.uid());
  return v_id;
end;
$$;

-- The classes I can open, newest year first, with my ⭐.
create or replace function khedma_2027.my_classes()
returns table (id uuid, name text, service_year text, is_default boolean, is_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.service_year, coalesce(m.is_default, false), m.user_id is not null
  from khedma_2027.classes c
  left join khedma_2027.class_members m on m.class_id = c.id and m.user_id = auth.uid()
  where khedma_2027.is_member(c.id)
  order by c.service_year desc, c.created_at
$$;

-- ⭐ Mark one of my classes as this year's (or none with null).
create or replace function khedma_2027.set_default_class(p_class uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update khedma_2027.class_members set is_default = false where user_id = auth.uid() and is_default;
  update khedma_2027.class_members set is_default = true where user_id = auth.uid() and class_id = p_class;
$$;

create or replace function khedma_2027.create_invite(p_class uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not khedma_2027.is_member(p_class) then raise exception 'not a member of this class'; end if;
  delete from khedma_2027.class_invites i where i.expires_at < now() or i.used_at is not null;
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from khedma_2027.class_invites i where i.code = v_code);
  end loop;
  return query
    insert into khedma_2027.class_invites as i (code, class_id, created_by)
    values (v_code, p_class, auth.uid())
    returning i.code, i.expires_at;
end;
$$;

-- Returns {"class_id": ...} on success, or {"error": "invalid" | "too_many"}.
create or replace function khedma_2027.join_class(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite khedma_2027.class_invites;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
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

create or replace function khedma_2027.leave_class(p_class uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from khedma_2027.class_members where class_id = p_class and user_id = auth.uid()
$$;

-- Admin: every account with its role and classes.
create or replace function khedma_2027.admin_list_users()
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, is_admin boolean, class_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not khedma_2027.is_admin() then raise exception 'admins only'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           coalesce(u.raw_app_meta_data ->> 'role' = 'admin', false),
           coalesce(array_agg(m.class_id) filter (where m.class_id is not null), '{}')
    from auth.users u
    left join khedma_2027.class_members m on m.user_id = u.id
    group by u.id
    order by u.created_at;
end;
$$;

revoke all on function khedma_2027.my_classes()               from public, anon;
revoke all on function khedma_2027.set_default_class(uuid)    from public, anon;
grant execute on function khedma_2027.my_classes()            to authenticated;
grant execute on function khedma_2027.set_default_class(uuid) to authenticated;
revoke all on function khedma_2027.create_class(text, text) from public, anon;
revoke all on function khedma_2027.create_invite(uuid)   from public, anon;
revoke all on function khedma_2027.join_class(text)      from public, anon;
revoke all on function khedma_2027.leave_class(uuid)     from public, anon;
revoke all on function khedma_2027.admin_list_users()    from public, anon;
grant execute on function khedma_2027.create_class(text, text) to authenticated;
grant execute on function khedma_2027.create_invite(uuid) to authenticated;
grant execute on function khedma_2027.join_class(text)    to authenticated;
grant execute on function khedma_2027.leave_class(uuid)   to authenticated;
grant execute on function khedma_2027.admin_list_users()  to authenticated;

-- =====================================================================
-- 5) Audit classes and memberships too
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

  v_row := coalesce(v_new, v_old);
  v_id := case tg_table_name
    when 'follow_up'     then (v_row ->> 'child_client_id') || '@' || (v_row ->> 'date') || '@' || (v_row ->> 'kind')
    when 'custom_fields' then v_row ->> 'key'
    when 'classes'       then v_row ->> 'id'
    when 'class_members' then (v_row ->> 'class_id') || '@' || (v_row ->> 'user_id')
    else v_row ->> 'client_id'
  end;

  insert into khedma_2027.audit_log (user_id, user_email, action, table_name, record_id, old_data, new_data, changed_fields)
  values (auth.uid(), auth.jwt() ->> 'email', lower(tg_op), tg_table_name, v_id, v_old, v_new, v_changed);

  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_classes on khedma_2027.classes;
create trigger audit_classes
  after insert or update or delete on khedma_2027.classes
  for each row execute function khedma_2027.audit_trigger();

drop trigger if exists audit_class_members on khedma_2027.class_members;
create trigger audit_class_members
  after insert or update or delete on khedma_2027.class_members
  for each row execute function khedma_2027.audit_trigger();
