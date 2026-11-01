-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 024.
-- أب الاعتراف of each child. Optional.
-- ⚠️ Run this BEFORE the app update reaches people: the app sends confession_father with every child it saves.

alter table khedma.children add column if not exists confession_father text;
