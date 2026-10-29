-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 016.
-- الحالة of a child: عادي (normal), مستتر (hidden), or إخوة الرب (brothers). Empty = not set yet.
-- ⚠️ Run this BEFORE the app update reaches people: the app now sends this column with every
-- child it saves, and saving fails while the column is missing.

alter table khedma.children add column if not exists category text
  check (category is null or category in ('normal', 'hidden', 'brothers'));
