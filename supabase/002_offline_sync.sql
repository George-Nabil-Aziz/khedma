-- Run once in Supabase SQL Editor (project: all-my-database).
-- Needed for offline add/edit + sync. Does not change or delete any existing data.

-- 1) Every child gets a stable id generated on the device, so a child added offline
--    is never inserted twice when the sync retries.
alter table khedma_2027.children
  add column if not exists client_id uuid not null default gen_random_uuid();

create unique index if not exists children_client_id_key
  on khedma_2027.children (client_id);

-- 2) updated_at is always set by the server on every edit — the app compares it
--    to detect when two people edited the same child (a conflict).
create or replace function khedma_2027.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists children_touch_updated_at on khedma_2027.children;
create trigger children_touch_updated_at
  before update on khedma_2027.children
  for each row execute function khedma_2027.touch_updated_at();
