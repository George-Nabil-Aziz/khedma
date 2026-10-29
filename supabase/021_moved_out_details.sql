-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 020.
-- Where a child who left the class went: the church and the servant there. Both optional.
-- ⚠️ Run this BEFORE the app update reaches people: the app sends these columns with every child it saves.

alter table khedma.children add column if not exists moved_to_church text;
alter table khedma.children add column if not exists moved_to_servant text;
