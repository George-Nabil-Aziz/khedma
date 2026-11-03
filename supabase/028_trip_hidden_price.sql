-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 027.
-- A third trip price, for مستتر children (الحالة "hidden"). Optional: left empty, a مستتر child
-- pays the normal price, as before this column existed.
-- ⚠️ Run this BEFORE the app update reaches people: the app sends hidden_price with every trip it saves.

alter table khedma.trips
  add column if not exists hidden_price numeric(10, 2) check (hidden_price is null or hidden_price >= 0); -- سعر المستتر
