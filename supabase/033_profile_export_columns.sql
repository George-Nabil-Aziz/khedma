-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 032.
-- التصدير → العواميد: the columns each servant picked for كشف الأولاد, kept on their account (not on
-- the device), per class: { "<class id>": ["house_number", "street", …] }. A class not in it = the default.
-- Each servant edits only their own row (the profiles policies from 007 already say so).
-- The app works before this runs (always the default columns), but keeping a choice needs it.

alter table khedma.profiles
  add column if not exists export_columns jsonb not null default '{}'::jsonb;
