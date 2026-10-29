-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 021.
-- My own order of the children (ترتيبي): `position` per child, shared by everyone in the class.
-- Smaller comes first; null = not placed yet (after the placed ones, by name).
-- ⚠️ Run this BEFORE the app update reaches people: the app sends this column with every child it saves.

alter table khedma.children add column if not exists position double precision;

-- Audit: same function as in 016, but moving a child up or down (only `position` changed) is not
-- logged — reordering would otherwise fill the log with "edited" entries.
create or replace function khedma.audit_trigger()
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
      and n.key not in ('updated_at', 'position');
    if v_changed is null then return new; end if;
  end if;

  v_old := v_old - 'photo';
  v_new := v_new - 'photo';

  v_row := coalesce(v_new, v_old);
  v_id := case tg_table_name
    when 'follow_up'       then (v_row ->> 'child_client_id') || '@' || (v_row ->> 'date') || '@' || (v_row ->> 'kind')
    when 'custom_fields'   then v_row ->> 'key'
    when 'classes'         then v_row ->> 'id'
    when 'class_members'   then (v_row ->> 'class_id') || '@' || (v_row ->> 'user_id')
    when 'class_day_marks' then (v_row ->> 'class_id') || '@' || (v_row ->> 'date')
    when 'profiles'        then v_row ->> 'user_id'
    when 'trips'           then v_row ->> 'id'
    when 'trip_children'   then (v_row ->> 'trip_id') || '@' || (v_row ->> 'child_client_id')
    when 'trip_payments'   then v_row ->> 'id'
    else v_row ->> 'client_id'
  end;

  insert into khedma.audit_log (user_id, user_email, action, table_name, record_id, old_data, new_data, changed_fields)
  values (auth.uid(), auth.jwt() ->> 'email', lower(tg_op), tg_table_name, v_id, v_old, v_new, v_changed);

  return coalesce(new, old);
end;
$$;
