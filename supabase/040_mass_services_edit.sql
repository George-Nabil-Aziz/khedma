-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 037.
-- القداس → الخدمات:
--   * the app now reads the whole list from these tables, so services and groups can be added, moved
--     to another group and deleted in the app (not only renamed / reordered);
--   * a group keeps the colour of its title row (the sheet's colours: pink, orange, blue, yellow);
--   * «القارئون» moves first: القارئون → هنمسك ايه: فى القارئون (درج البخور) → أمين أمين صلوا …
--     (it becomes the last service of the group just before «هنمسك ايه: فى القارئون»);
--   * a new, empty group «مردات بعد القسمة» at the end.
-- Safe to re-run.

-- 1) a colour per group (hex without '#'; null = the built-in colour for that group)
alter table khedma.mass_service_groups add column if not exists color text;
alter table khedma.mass_service_groups drop constraint if exists mass_service_groups_color_check;
alter table khedma.mass_service_groups add constraint mass_service_groups_color_check
  check (color is null or color ~ '^[0-9A-F]{6}$');

update khedma.mass_service_groups set color = case key
  when 'hold_lamb' then 'E49EDD'
  when 'hold_readers' then 'E49EDD'
  when 'readings' then 'FF9900'
  when 'incense' then '6D9EEB'
  else 'FFFF00'
end
where color is null;

-- 2) «القارئون» → the end of «responses_3» (only while it still sits in «responses_4»)
do $$
begin
  if exists (select 1 from khedma.mass_services where key = 'readers' and group_key = 'responses_4')
     and exists (select 1 from khedma.mass_service_groups where key = 'responses_3') then
    update khedma.mass_services
       set group_key = 'responses_3',
           position = (select coalesce(max(position), 0) + 1 from khedma.mass_services where group_key = 'responses_3')
     where key = 'readers';
    -- close the gap it left in responses_4
    update khedma.mass_services s
       set position = r.n
      from (select key, row_number() over (order by position) as n from khedma.mass_services where group_key = 'responses_4') r
     where s.key = r.key;
  end if;
end $$;

-- 3) «مردات بعد القسمة», empty, at the end
insert into khedma.mass_service_groups (key, title, position, color)
select 'after_fraction', 'مردات بعد القسمة', coalesce(max(position), 0) + 1, 'FFFF00' from khedma.mass_service_groups
on conflict (key) do nothing;
