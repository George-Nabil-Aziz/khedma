-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 035.
-- Sharing القداس like a class: an admin (or a mass member) gets a one-time 6-digit code (valid
-- 15 minutes), a colleague types it where class codes go and becomes a mass member — the whole
-- القداس section, without being in any class. Admins keep full access. A member can leave;
-- an admin can remove anyone. Replaces the admins-only policies of 035 by "mass members".

-- =====================================================================
-- 1) Tables (only reached through the functions below)
-- =====================================================================
create table if not exists khedma.mass_members (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now()
);

create table if not exists khedma.mass_invites (
  code       text primary key,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_by    uuid,
  used_at    timestamptz
);

alter table khedma.mass_members enable row level security;
alter table khedma.mass_invites enable row level security;
revoke all on khedma.mass_members, khedma.mass_invites from anon, authenticated;

-- =====================================================================
-- 2) Who counts as a mass member: admins, and whoever joined with a code
-- =====================================================================
create or replace function khedma.is_mass_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select khedma.is_admin() or exists (select 1 from khedma.mass_members m where m.user_id = auth.uid())
$$;
revoke all on function khedma.is_mass_member() from public, anon;
grant execute on function khedma.is_mass_member() to authenticated;

-- =====================================================================
-- 3) Codes: make, join, leave, list, remove
-- =====================================================================
create or replace function khedma.create_mass_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not khedma.is_mass_member() then raise exception 'not a member of the mass section'; end if;
  delete from khedma.mass_invites i where i.expires_at < now() or i.used_at is not null;
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from khedma.mass_invites i where i.code = v_code)
          and not exists (select 1 from khedma.class_invites c where c.code = v_code and c.used_at is null and c.expires_at > now());
  end loop;
  return query
    insert into khedma.mass_invites as i (code, created_by)
    values (v_code, auth.uid())
    returning i.code, i.expires_at;
end;
$$;

-- Returns {"joined": true} on success, or {"error": "invalid" | "too_many"}.
-- Failed attempts count in the same table as class codes.
create or replace function khedma.join_mass(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite khedma.mass_invites;
begin
  if not khedma.is_app_user() then raise exception 'not a Khedma account'; end if;
  if (select count(*) from khedma.join_failures f where f.user_id = auth.uid() and f.at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'too_many');
  end if;

  select * into v_invite from khedma.mass_invites i
  where i.code = trim(p_code) and i.used_at is null and i.expires_at > now()
  for update;

  if not found then
    insert into khedma.join_failures (user_id) values (auth.uid());
    return jsonb_build_object('error', 'invalid');
  end if;

  insert into khedma.mass_members (user_id) values (auth.uid()) on conflict do nothing;
  update khedma.mass_invites set used_by = auth.uid(), used_at = now() where code = v_invite.code;
  return jsonb_build_object('joined', true);
end;
$$;

-- One input for both kinds of code: join_class (as in 009) first tries a class code; a code that
-- is no class code but a valid mass code joins the mass section and answers {"mass": true}.
create or replace function khedma.join_class(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite khedma.class_invites;
begin
  if not khedma.is_app_user() then raise exception 'not a Khedma account'; end if;
  if (select count(*) from khedma.join_failures f where f.user_id = auth.uid() and f.at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'too_many');
  end if;

  select * into v_invite from khedma.class_invites i
  where i.code = trim(p_code) and i.used_at is null and i.expires_at > now()
  for update;

  if not found then
    if exists (select 1 from khedma.mass_invites m where m.code = trim(p_code) and m.used_at is null and m.expires_at > now()) then
      perform khedma.join_mass(p_code);
      return jsonb_build_object('mass', true);
    end if;
    insert into khedma.join_failures (user_id) values (auth.uid());
    return jsonb_build_object('error', 'invalid');
  end if;

  insert into khedma.class_members (class_id, user_id) values (v_invite.class_id, auth.uid())
  on conflict (class_id, user_id) do update set left_at = null;
  update khedma.class_invites set used_by = auth.uid(), used_at = now() where code = v_invite.code;
  return jsonb_build_object('class_id', v_invite.class_id);
end;
$$;

create or replace function khedma.leave_mass()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from khedma.mass_members where user_id = auth.uid()
$$;

-- Admin: who has mass access (besides admins).
create or replace function khedma.admin_list_mass_members()
returns table (user_id uuid, email text, display_name text, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not khedma.is_admin() then raise exception 'admins only'; end if;
  return query
    select m.user_id, u.email::text, p.display_name, m.joined_at
    from khedma.mass_members m
    join auth.users u on u.id = m.user_id
    left join khedma.profiles p on p.user_id = m.user_id
    order by m.joined_at;
end;
$$;

create or replace function khedma.remove_mass_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not khedma.is_admin() then raise exception 'admins only'; end if;
  delete from khedma.mass_members where user_id = p_user;
end;
$$;

revoke all on function khedma.create_mass_invite()          from public, anon;
revoke all on function khedma.join_mass(text)               from public, anon;
revoke all on function khedma.join_class(text)              from public, anon;
revoke all on function khedma.leave_mass()                  from public, anon;
revoke all on function khedma.admin_list_mass_members()     from public, anon;
revoke all on function khedma.remove_mass_member(uuid)      from public, anon;
grant execute on function khedma.create_mass_invite()       to authenticated;
grant execute on function khedma.join_mass(text)            to authenticated;
grant execute on function khedma.join_class(text)           to authenticated;
grant execute on function khedma.leave_mass()               to authenticated;
grant execute on function khedma.admin_list_mass_members()  to authenticated;
grant execute on function khedma.remove_mass_member(uuid)   to authenticated;

-- =====================================================================
-- 4) The mass tables: admins AND mass members (replaces the policies of 035)
-- =====================================================================
drop policy if exists "admins use mass classes" on khedma.mass_classes;
drop policy if exists "mass members use mass classes" on khedma.mass_classes;
create policy "mass members use mass classes" on khedma.mass_classes for all to authenticated
  using (khedma.is_mass_member()) with check (khedma.is_mass_member());

drop policy if exists "admins use mass children" on khedma.mass_children;
drop policy if exists "mass members use mass children" on khedma.mass_children;
create policy "mass members use mass children" on khedma.mass_children for all to authenticated
  using (khedma.is_mass_member()) with check (khedma.is_mass_member());

drop policy if exists "admins use masses" on khedma.masses;
drop policy if exists "mass members use masses" on khedma.masses;
create policy "mass members use masses" on khedma.masses for all to authenticated
  using (khedma.is_mass_member()) with check (khedma.is_mass_member());

drop policy if exists "admins use mass assignments" on khedma.mass_assignments;
drop policy if exists "mass members use mass assignments" on khedma.mass_assignments;
create policy "mass members use mass assignments" on khedma.mass_assignments for all to authenticated
  using (khedma.is_mass_member()) with check (khedma.is_mass_member());
