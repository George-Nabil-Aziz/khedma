-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 030.
-- المدرسة of each child. Optional.
-- ⚠️ Run this BEFORE the app update reaches people: the app sends school with every child it saves.

alter table khedma.children add column if not exists school text;
