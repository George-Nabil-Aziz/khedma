-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 013.
-- App-wide settings (الإعدادات). The first one: an admin can move the end of the service year by
-- up to 3 Fridays either way. 0 = as before, the first Friday after 6 October; +2 = two Fridays
-- after that; -1 = one Friday earlier. It applies to every service year, and the app uses the
-- same rule (src/lib/serviceYear.ts).

-- =====================================================================
-- 1) Settings table: everyone signed in reads, only admins write (through the function below)
-- =====================================================================
create table if not exists khedma.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table khedma.settings enable row level security;

drop policy if exists "settings: read" on khedma.settings;
create policy "settings: read" on khedma.settings for select to authenticated using (true);

grant select on khedma.settings to authenticated;

insert into khedma.settings (key, value) values ('year_end_weeks', '0') on conflict (key) do nothing;

create or replace function khedma.set_year_end_weeks(p_weeks int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not khedma.is_admin() then raise exception 'admins only'; end if;
  if p_weeks is null or p_weeks not between -3 and 3 then raise exception 'weeks must be between -3 and 3'; end if;
  insert into khedma.settings (key, value, updated_at, updated_by)
  values ('year_end_weeks', to_jsonb(p_weeks), now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
end;
$$;

revoke all on function khedma.set_year_end_weeks(int) from public, anon;
grant execute on function khedma.set_year_end_weeks(int) to authenticated;

-- =====================================================================
-- 2) Service year end now reads the setting (so it is "stable", no longer "immutable")
-- =====================================================================
create or replace function khedma.service_year_end(p_year int)
returns date
language sql
stable
set search_path = ''
as $$
  select make_date(p_year, 10, 6)
       + coalesce(nullif((5 - extract(dow from make_date(p_year, 10, 6))::int + 7) % 7, 0), 7)
       + 7 * coalesce((select (value #>> '{}')::int from khedma.settings where key = 'year_end_weeks'), 0)
$$;
