-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 014.
-- A Friday can now also be a club day (يوم نادي), besides — or together with — a communion day.
-- The app always sends both columns of a day, so a row may now have communion = false.

alter table khedma.class_day_marks add column if not exists club boolean not null default false;
alter table khedma.class_day_marks alter column communion set default false;
