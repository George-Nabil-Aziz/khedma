-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 017.
-- A trip can take more than one day: trip_date is the first day, end_date the last
-- (empty = a one-day trip).
-- ⚠️ Run this BEFORE the app update reaches people: the app sends end_date when a trip is saved.

alter table khedma.trips add column if not exists end_date date;
alter table khedma.trips drop constraint if exists trips_end_after_start;
alter table khedma.trips add constraint trips_end_after_start
  check (end_date is null or trip_date is null or end_date >= trip_date);
