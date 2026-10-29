-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 022.
-- The default look of the children table, set by an admin in الإعدادات: the order of the
-- columns and which are hidden. "Default" in anyone's columns menu goes back to this.
-- Stored in khedma.settings as 'column_defaults' = { "order": [...ids], "hidden": [...ids] }.
-- (Without it the app keeps its built-in default, so this can be run before or after the update.)

create or replace function khedma.set_column_defaults(p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not khedma.is_admin() then raise exception 'admins only'; end if;
  if p_value is null
     or jsonb_typeof(p_value -> 'order') <> 'array'
     or jsonb_typeof(p_value -> 'hidden') <> 'array' then
    raise exception 'expected { order: [...], hidden: [...] }';
  end if;
  insert into khedma.settings (key, value, updated_at, updated_by)
  values ('column_defaults', p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
end;
$$;

revoke all on function khedma.set_column_defaults(jsonb) from public, anon;
grant execute on function khedma.set_column_defaults(jsonb) to authenticated;
