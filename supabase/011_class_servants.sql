-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 010.
-- The servants of a class (name, photo, email), for the Classes page.
-- Only members of that class — and admins — can see the list.

create or replace function khedma_2027.class_servants(p_class uuid)
returns table (user_id uuid, email text, display_name text, photo text, joined_at timestamptz, is_admin boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not khedma_2027.is_member(p_class) then raise exception 'not a member of this class'; end if;
  return query
    select m.user_id, u.email::text, p.display_name, p.photo, m.joined_at,
           coalesce(u.raw_app_meta_data ->> 'role' = 'admin', false)
    from khedma_2027.class_members m
    join auth.users u on u.id = m.user_id
    left join khedma_2027.profiles p on p.user_id = m.user_id
    where m.class_id = p_class and m.left_at is null
    order by m.joined_at;
end;
$$;

revoke all on function khedma_2027.class_servants(uuid) from public, anon;
grant execute on function khedma_2027.class_servants(uuid) to authenticated;
