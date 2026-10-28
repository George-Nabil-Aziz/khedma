-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 008.
-- Leaving a class no longer deletes the membership straight away: it is marked as left, the
-- servant immediately stops seeing the class's data, and for 7 days the class stays in their
-- list (greyed out) with a "rejoin" button. After 7 days it is gone from their list.

alter table khedma_2027.class_members add column if not exists left_at timestamptz;

-- Only current members (not ones who left) can see a class's data.
create or replace function khedma_2027.is_member(p_class uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select khedma_2027.is_admin()
      or exists (
        select 1 from khedma_2027.class_members m
        where m.class_id = p_class and m.user_id = auth.uid() and m.left_at is null
      )
$$;

create or replace function khedma_2027.leave_class(p_class uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update khedma_2027.class_members
  set left_at = now(), is_default = false
  where class_id = p_class and user_id = auth.uid() and left_at is null
$$;

-- Back in, if it is within 7 days of leaving. Returns false when it is too late.
create or replace function khedma_2027.rejoin_class(p_class uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update khedma_2027.class_members
  set left_at = null
  where class_id = p_class and user_id = auth.uid() and left_at > now() - interval '7 days';
  return found;
end;
$$;

revoke all on function khedma_2027.rejoin_class(uuid) from public, anon;
grant execute on function khedma_2027.rejoin_class(uuid) to authenticated;

-- My classes, plus the ones I left in the last 7 days (left_at set) so I can rejoin.
drop function if exists khedma_2027.my_classes();
create function khedma_2027.my_classes()
returns table (id uuid, name text, service_year text, is_default boolean, is_member boolean, left_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.service_year,
         coalesce(m.is_default, false),
         m.user_id is not null and m.left_at is null,
         m.left_at
  from khedma_2027.classes c
  left join khedma_2027.class_members m on m.class_id = c.id and m.user_id = auth.uid()
  where khedma_2027.is_member(c.id)
     or m.left_at > now() - interval '7 days'
  order by c.service_year desc, c.created_at
$$;

revoke all on function khedma_2027.my_classes() from public, anon;
grant execute on function khedma_2027.my_classes() to authenticated;

-- A share code brings back someone who had left.
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

  insert into khedma_2027.class_members (class_id, user_id) values (v_invite.class_id, auth.uid())
  on conflict (class_id, user_id) do update set left_at = null;
  update khedma_2027.class_invites set used_by = auth.uid(), used_at = now() where code = v_invite.code;
  return jsonb_build_object('class_id', v_invite.class_id);
end;
$$;

-- Admins can put someone back in a class they had left (the Users page).
drop policy if exists "admins edit members" on khedma_2027.class_members;
create policy "admins edit members" on khedma_2027.class_members
  for update to authenticated using (khedma_2027.is_admin()) with check (khedma_2027.is_admin());

-- Users page: only classes people are still in.
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
           coalesce(array_agg(m.class_id) filter (where m.class_id is not null and m.left_at is null), '{}')
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
