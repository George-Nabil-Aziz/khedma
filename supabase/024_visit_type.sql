-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 023.
-- الافتقاد can be a phone call (phone) or a home visit (home). Only for kind = 'visit';
-- null on الحضور ticks, and on visits ticked before this (shown as a plain ✓).
-- ⚠️ Run this BEFORE the app update reaches people: the app sends visit_type with every tick.

alter table khedma.follow_up add column if not exists visit_type text
  check (visit_type is null or visit_type in ('phone', 'home'));
