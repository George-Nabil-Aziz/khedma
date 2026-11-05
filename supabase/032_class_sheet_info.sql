-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 031.
-- بيانات الكشف: the header of the exported sheets (تصدير): أمين الأسرة, الأمين المساعد,
-- منطقة الخدمة, السنة الدراسية, and — when changed from the defaults — the title and the servants.
-- Kept as one jsonb so more header lines need no new column. Any member of the class can edit it
-- (same policy as renaming the class).
-- The app works before this runs (the header shows empty), but saving it needs it.

alter table khedma.classes
  add column if not exists sheet_info jsonb not null default '{}'::jsonb;

-- my_classes() now also returns sheet_info (same as 029 otherwise).
drop function if exists khedma.my_classes();
create function khedma.my_classes()
returns table (id uuid, name text, service_year text, is_default boolean, is_member boolean, left_at timestamptz, service_day smallint, sheet_info jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.service_year,
         coalesce(m.is_default, false),
         m.user_id is not null and m.left_at is null,
         m.left_at,
         c.service_day,
         c.sheet_info
  from khedma.classes c
  left join khedma.class_members m on m.class_id = c.id and m.user_id = auth.uid()
  where khedma.is_member(c.id)
     or m.left_at > now() - interval '7 days'
  order by c.service_year desc, c.created_at
$$;

revoke all on function khedma.my_classes() from public, anon;
grant execute on function khedma.my_classes() to authenticated;
