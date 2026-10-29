-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 018.
-- A child who also lives in another home (e.g. the grandparents'):
--   address_label  whose home the usual address is ("بيت الجد") — only used when there is a second one
--   other_address  the second home: { label, house_number, street, branch_of_street, landmark,
--                  floor, side, apartment }, or null
-- The table keeps showing the usual (first) address.
-- ⚠️ Run this BEFORE the app update reaches people: the app sends both columns with every child it saves.

alter table khedma.children add column if not exists address_label text;
alter table khedma.children add column if not exists other_address jsonb
  check (other_address is null or jsonb_typeof(other_address) = 'object');
