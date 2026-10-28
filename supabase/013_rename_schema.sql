-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 012.
-- Renames the schema khedma_2027 → khedma. Tables, data, policies, grants and triggers move with it.
-- Function bodies are plain text, so every function that names khedma_2027.something inside its
-- body is re-created with khedma.something instead. The sign-up tag 'khedma_2027' (no dot) is left
-- as it is, so accounts that already carry it stay on Khedma's list.
-- Right after running this: Settings → API → Exposed schemas: replace khedma_2027 with khedma.

alter schema khedma_2027 rename to khedma;

do $$
declare
  f record;
begin
  for f in
    select p.oid
      from pg_proc p
     where p.pronamespace = 'khedma'::regnamespace
       and p.prokind = 'f'
       and pg_get_functiondef(p.oid) like '%khedma\_2027.%'
  loop
    execute replace(pg_get_functiondef(f.oid), 'khedma_2027.', 'khedma.');
  end loop;
end $$;

-- Empty placeholder: the API still lists khedma_2027 until you change Exposed schemas, and a
-- missing schema there can take down the whole API (bishoy's app too). Drop it after the change:
--   drop schema khedma_2027;
create schema khedma_2027;

-- Check: this should return no rows.
-- select p.proname from pg_proc p
--  where p.pronamespace = 'khedma'::regnamespace and pg_get_functiondef(p.oid) like '%khedma\_2027.%';
