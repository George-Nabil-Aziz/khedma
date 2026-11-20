-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 033.
-- The default birthday reminder times, set by an admin in الإعدادات → الإشعارات.
-- "الافتراضي" there goes back to them, and anyone who never picked their own gets them.
-- Stored in khedma.settings as 'reminder_defaults' = [{ "when": "day_before", "time": "21:00" }, ...].
-- (Without it the app keeps its built-in times, so this can be run before or after the update.)

create or replace function khedma.set_reminder_defaults(p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not khedma.is_admin() then raise exception 'admins only'; end if;
  if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 10 then
    raise exception 'expected [{ when, time }, ...] (10 at most)';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_value) r
    where r ->> 'when' not in ('friday_before', 'week_before', 'two_days_before', 'day_before', 'same_day')
       or coalesce(r ->> 'time', '') !~ '^\d{2}:\d{2}$'
  ) then
    raise exception 'bad reminder';
  end if;
  insert into khedma.settings (key, value, updated_at, updated_by)
  values ('reminder_defaults', p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
end;
$$;

revoke all on function khedma.set_reminder_defaults(jsonb) from public, anon;
grant execute on function khedma.set_reminder_defaults(jsonb) to authenticated;
