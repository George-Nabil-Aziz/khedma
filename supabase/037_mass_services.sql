-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 036.
-- القداس → الخدمات: the names of the schedule — group titles, service names, and the labels of
-- two-line services (e.g. دورة البولس: الصليب / البشارة) — editable in the app. The keys are the
-- ones the app uses today (and mass_assignments.service_key), so every saved schedule keeps working.
-- The app keeps the keys and the number of lines of each service in code; these tables hold the names
-- and the ORDER (position) of the groups and of the services inside a group, both editable in the app.
-- Seeded from the built-in list; safe to re-run, and it never overwrites a name or order that was edited.

-- =====================================================================
-- 1) Tables
-- =====================================================================
create table if not exists khedma.mass_service_groups (
  key      text primary key,
  title    text not null check (length(trim(title)) > 0),
  position int not null
);

create table if not exists khedma.mass_services (
  key         text primary key,
  group_key   text not null references khedma.mass_service_groups (key) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  slots       smallint not null default 1 check (slots between 1 and 2),
  slot_labels text[],               -- one per line of a two-line service; '' = just the number
  position    int not null
);
create index if not exists mass_services_group_idx on khedma.mass_services (group_key, position);

-- =====================================================================
-- 2) Admins and mass members
-- =====================================================================
alter table khedma.mass_service_groups enable row level security;
alter table khedma.mass_services enable row level security;
revoke all on khedma.mass_service_groups, khedma.mass_services from anon;
grant select, insert, update, delete on khedma.mass_service_groups, khedma.mass_services to authenticated;

drop policy if exists "mass members use service groups" on khedma.mass_service_groups;
create policy "mass members use service groups" on khedma.mass_service_groups for all to authenticated
  using (khedma.is_mass_member()) with check (khedma.is_mass_member());

drop policy if exists "mass members use services" on khedma.mass_services;
create policy "mass members use services" on khedma.mass_services for all to authenticated
  using (khedma.is_mass_member()) with check (khedma.is_mass_member());

-- =====================================================================
-- 3) The built-in names
-- =====================================================================
insert into khedma.mass_service_groups (key, title, position) values
  ('hold_lamb', 'هنمسك ايه : تقديم الحمل', 1),
  ('responses_1', 'المردات', 2),
  ('readings', 'القراءات', 3),
  ('responses_2', 'باقى المردات', 4),
  ('incense', 'الشورية', 5),
  ('responses_3', 'باقى المردات', 6),
  ('hold_readers', 'هنمسك ايه: فى القارئون', 7),
  ('responses_4', 'باقى المردات', 8)
on conflict (key) do nothing;

insert into khedma.mass_services (key, group_key, name, slots, slot_labels, position) values
  ('qarura', 'hold_lamb', 'القارورة', 1, null, 1),
  ('water_jug', 'hold_lamb', 'ابريق المياه', 1, null, 2),
  ('pray_offerings', 'responses_1', 'صلوا من أجل هذه القرابين', 1, null, 1),
  ('amen_rushumat', 'responses_1', 'أمين و الرشومات', 1, null, 2),
  ('aspatir', 'responses_1', 'اسباتير', 1, null, 3),
  ('ai_ebros_1', 'responses_1', 'ايه يى ابروس ايفشى 1', 1, null, 4),
  ('pros_afxasti', 'responses_1', 'بروس افكساستى', 1, null, 5),
  ('ask_mercy', 'responses_1', 'اطلبوا لكى يرحمنا الله', 1, null, 6),
  ('bolos', 'readings', 'قرأة البولس', 1, null, 1),
  ('bolos_round', 'readings', 'دورة البولس', 2, array['الصليب', 'البشارة']::text[], 2),
  ('catholicon', 'readings', 'الكاثوليكون', 1, null, 3),
  ('abraksis', 'readings', 'الابركسيس', 1, null, 4),
  ('abraksis_round', 'readings', 'دورة الابركسيس', 2, array['الصليب', 'البشارة']::text[], 5),
  ('gospel_prayer', 'readings', 'اوشية الأنجيل', 1, null, 6),
  ('gospel', 'readings', 'الأنجيل', 1, null, 7),
  ('ensofia', 'readings', 'انصوفيا', 1, null, 8),
  ('ai_ebros_2', 'responses_2', 'ايه يى ابروس ايفشى 2', 1, null, 1),
  ('pray_peace', 'responses_2', 'صلوا من أجل السلام الكامل', 1, null, 2),
  ('kiss', 'responses_2', 'قبلوا بعضكم بعضا', 1, null, 3),
  ('sit_stand', 'responses_2', 'ايها الجلوس قفوا', 1, null, 4),
  ('look_east', 'responses_2', 'و الى الشرق انظروا', 1, null, 5),
  ('listen', 'responses_2', 'ننصت', 1, null, 6),
  ('incense_incarnation', 'incense', 'تقديم الشريا وتجسد و تأنس', 1, null, 1),
  ('incense_foundation', 'incense', 'تقديم الشريا فى صلوات التأسيس', 1, null, 2),
  ('bow_to_god', 'responses_3', 'اسجدوا لله بخوف', 1, null, 1),
  ('listen_amen', 'responses_3', 'ننصت أمين', 1, null, 2),
  ('offerings_prayer', 'responses_3', 'اوشية القرابين', 1, null, 3),
  ('incense_tray', 'hold_readers', 'يمسك درج البخور فى القارئون', 1, null, 1),
  ('readers', 'responses_4', 'القارئون', 1, null, 1),
  ('amen_amen', 'responses_4', 'أمين أمين صلوا', 1, null, 2),
  ('taski_falas', 'responses_4', 'طاسكي فالاس', 1, null, 3),
  ('abros_khomin', 'responses_4', 'أبروس خومين', 1, null, 4),
  ('truly_done', 'responses_4', 'خلصت حقا', 1, null, 5),
  ('confession', 'responses_4', 'الاعتراف', 1, null, 6)
on conflict (key) do nothing;
