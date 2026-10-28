-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 011.
-- Admins only: delete a whole class — its children (and their متابعة ticks), custom columns,
-- members, share codes and communion days. Each deleted child is written to the audit log with
-- all its data by the children trigger, so a mistake can still be recovered from there.

create or replace function khedma_2027.delete_class(p_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not khedma_2027.is_admin() then raise exception 'admins only'; end if;
  -- children first: they block deleting the class (on delete restrict); follow_up goes with them
  delete from khedma_2027.children where class_id = p_class;
  -- the rest is removed with the class (on delete cascade)
  delete from khedma_2027.classes where id = p_class;
end;
$$;

revoke all on function khedma_2027.delete_class(uuid) from public, anon;
grant execute on function khedma_2027.delete_class(uuid) to authenticated;
