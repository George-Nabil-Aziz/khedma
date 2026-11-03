-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 028.
-- The day of the week each class meets (يوم الخدمة): 0 = Sunday … 5 = Friday … 6 = Saturday.
-- Every class starts on Friday, as before. The متابعة grid and أيام التناول والنادي follow it;
-- the service year still ends on the first Friday after 6 October.
-- The app works before this runs (it treats every class as Friday), but choosing a day needs it.

alter table khedma.classes
  add column if not exists service_day smallint not null default 5 check (service_day between 0 and 6);

-- my_classes() now also returns service_day (same as 009 otherwise).
drop function if exists khedma.my_classes();
create function khedma.my_classes()
returns table (id uuid, name text, service_year text, is_default boolean, is_member boolean, left_at timestamptz, service_day smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.service_year,
         coalesce(m.is_default, false),
         m.user_id is not null and m.left_at is null,
         m.left_at,
         c.service_day
  from khedma.classes c
  left join khedma.class_members m on m.class_id = c.id and m.user_id = auth.uid()
  where khedma.is_member(c.id)
     or m.left_at > now() - interval '7 days'
  order by c.service_year desc, c.created_at
$$;

revoke all on function khedma.my_classes() from public, anon;
grant execute on function khedma.my_classes() to authenticated;
