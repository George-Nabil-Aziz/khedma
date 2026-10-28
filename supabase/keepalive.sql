-- Run once in Supabase SQL Editor (project: all-my-database).
-- A tiny function the GitHub Action calls every 3 days so the free project never pauses.
-- It returns only the current time — it does not touch the children table.

create or replace function khedma_2027.ping()
returns timestamptz
language sql
stable
as $$ select now() $$;

revoke all on function khedma_2027.ping() from public;
grant execute on function khedma_2027.ping() to anon, authenticated;
