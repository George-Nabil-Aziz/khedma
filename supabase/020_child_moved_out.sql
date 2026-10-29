-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 019.
-- A child who left the class (moved elsewhere) stays in it, listed at the bottom under a line.
-- moved_out_on = the day they left; null = still in the class.
-- ⚠️ Run this BEFORE the app update reaches people: the app sends this column with every child it saves.

alter table khedma.children add column if not exists moved_out_on date;
