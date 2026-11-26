-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 034.
-- القداس: the children's mass serving schedule — admins only. Each mass (a date) has a list of
-- services (the list itself lives in the app); each one gets a servant class (الخادم) and one of
-- that class's children (المخدوم). The classes and their children below are the names to pick
-- from — separate from the service classes of the app. Seeded at the end (safe to re-run).

-- =====================================================================
-- 1) Tables
-- =====================================================================
-- A servant class: named by its servants together, e.g. "جون شوقى - جورج نبيل".
create table if not exists khedma.mass_classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) > 0),
  position   int,
  created_at timestamptz not null default now()
);

-- A child of one of those classes. The phone is text so a leading 0 stays.
create table if not exists khedma.mass_children (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references khedma.mass_classes (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  phone      text,
  note       text,
  position   int,
  created_at timestamptz not null default now()
);
create index if not exists mass_children_class_idx on khedma.mass_children (class_id, position);

-- One mass = one day.
create table if not exists khedma.masses (
  id         uuid primary key default gen_random_uuid(),
  mass_date  date not null unique,
  notes      text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who serves what in a mass: service_key is the app's own key (e.g. 'qarura'); slot 1 or 2
-- for the services that have two lines.
create table if not exists khedma.mass_assignments (
  mass_id     uuid not null references khedma.masses (id) on delete cascade,
  service_key text not null,
  slot        smallint not null default 1 check (slot between 1 and 2),
  class_id    uuid references khedma.mass_classes (id) on delete set null,
  child_id    uuid references khedma.mass_children (id) on delete set null,
  primary key (mass_id, service_key, slot)
);

drop trigger if exists masses_touch_updated_at on khedma.masses;
create trigger masses_touch_updated_at
  before update on khedma.masses
  for each row execute function khedma.touch_updated_at();

-- =====================================================================
-- 2) Admins only
-- =====================================================================
alter table khedma.mass_classes enable row level security;
alter table khedma.mass_children enable row level security;
alter table khedma.masses enable row level security;
alter table khedma.mass_assignments enable row level security;
revoke all on khedma.mass_classes, khedma.mass_children, khedma.masses, khedma.mass_assignments from anon;
grant select, insert, update, delete on khedma.mass_classes, khedma.mass_children, khedma.masses, khedma.mass_assignments to authenticated;

drop policy if exists "admins use mass classes" on khedma.mass_classes;
create policy "admins use mass classes" on khedma.mass_classes for all to authenticated
  using (khedma.is_admin()) with check (khedma.is_admin());

drop policy if exists "admins use mass children" on khedma.mass_children;
create policy "admins use mass children" on khedma.mass_children for all to authenticated
  using (khedma.is_admin()) with check (khedma.is_admin());

drop policy if exists "admins use masses" on khedma.masses;
create policy "admins use masses" on khedma.masses for all to authenticated
  using (khedma.is_admin()) with check (khedma.is_admin());

drop policy if exists "admins use mass assignments" on khedma.mass_assignments;
create policy "admins use mass assignments" on khedma.mass_assignments for all to authenticated
  using (khedma.is_admin()) with check (khedma.is_admin());

-- =====================================================================
-- 3) The names
-- =====================================================================
insert into khedma.mass_classes (name, position) values
  ('جون شوقى - جورج نبيل', 1),
  ('أ.عماد - فادى ميلاد', 2),
  ('أنطونيوس ماجد (تونى) - مينا مجدى', 3),
  ('ابانوب رأفت - مينا مفيد - جون عادل', 4),
  ('كيرلس عماد - رامز نجيب', 5),
  ('جون أمير - مينا سامى - كيرلس ياسر', 6),
  ('بيشوى جمال', 7),
  ('مارك ماجد - كيرلس هانى', 8),
  ('جورج جمال - كيرلس يسري', 9),
  ('فادى ميشيل - جون عماد', 10)
on conflict (name) do nothing;

-- A class gets its children only while it has none yet, so re-running never duplicates them
-- (nor brings back one that was deleted or renamed later).
insert into khedma.mass_children (class_id, name, phone, note, position)
select c.id, v.child, v.phone, v.note, v.pos
from (values
  ('جون شوقى - جورج نبيل', 'بولا برسوم', '01277784196', null, 1),
  ('جون شوقى - جورج نبيل', 'بيشوى اشرف', '01220062571', null, 2),
  ('جون شوقى - جورج نبيل', 'جاستن مينا', '01006863474', null, 3),
  ('جون شوقى - جورج نبيل', 'جيوفانى جورج', '01064220589', null, 4),
  ('جون شوقى - جورج نبيل', 'مارسلينو اندرو', '01090463318', null, 5),
  ('جون شوقى - جورج نبيل', 'مينا مايكل', '01288230881', null, 6),
  ('جون شوقى - جورج نبيل', 'يوسف رامز', '01014265102', null, 7),

  ('أ.عماد - فادى ميلاد', 'جونى سامح', '01211935899', null, 1),
  ('أ.عماد - فادى ميلاد', 'افرايم مينا', '01553544257', null, 2),
  ('أ.عماد - فادى ميلاد', 'مينا باسم', '01206635190', null, 3),

  ('أنطونيوس ماجد (تونى) - مينا مجدى', 'اندريا فادى', '01030193633', null, 1),

  ('ابانوب رأفت - مينا مفيد - جون عادل', 'اندرو رامين', '01226067241', null, 1),
  ('ابانوب رأفت - مينا مفيد - جون عادل', 'انطون صموئيل', '01557357150', null, 2),
  ('ابانوب رأفت - مينا مفيد - جون عادل', 'دانيال وليد', '01202313238', null, 3),
  ('ابانوب رأفت - مينا مفيد - جون عادل', 'فردريك فادي', '01558652004', null, 4),
  ('ابانوب رأفت - مينا مفيد - جون عادل', 'كيفين محسن', '01210657890', null, 5),
  ('ابانوب رأفت - مينا مفيد - جون عادل', 'كاراس شادي', '01224466214', null, 6),
  ('ابانوب رأفت - مينا مفيد - جون عادل', 'يوسف جورج', '01228970272', null, 7),
  ('ابانوب رأفت - مينا مفيد - جون عادل', 'يوسف كرم', '01281747244', null, 8),

  ('كيرلس عماد - رامز نجيب', 'مارسيلينو جوزيف', '01200291182', null, 1),
  ('كيرلس عماد - رامز نجيب', 'مارسلينو جرجس', '01225906810', null, 2),
  ('كيرلس عماد - رامز نجيب', 'دانيال عادل', '01205194083', null, 3),
  ('كيرلس عماد - رامز نجيب', 'شنودة نبيل', '01289736648', null, 4),
  ('كيرلس عماد - رامز نجيب', 'كيفين سامي', '01207532509', null, 5),
  ('كيرلس عماد - رامز نجيب', 'كارلوس مينا', '01272765303', null, 6),
  ('كيرلس عماد - رامز نجيب', 'فيلوباتير', null, 'مفيش رقم', 7),

  ('جون أمير - مينا سامى - كيرلس ياسر', 'بافلي ايهاب', '01272997715', null, 1),
  ('جون أمير - مينا سامى - كيرلس ياسر', 'جيسون يوحنا', '01228347420', null, 2),
  ('جون أمير - مينا سامى - كيرلس ياسر', 'باتريك بطرس', '01200825986', null, 3),
  ('جون أمير - مينا سامى - كيرلس ياسر', 'جوساب فادي', '01229295828', null, 4),
  ('جون أمير - مينا سامى - كيرلس ياسر', 'جون شنودة', '01225890834', null, 5),
  ('جون أمير - مينا سامى - كيرلس ياسر', 'كيرلس عاطف', '01210700785', null, 6),
  ('جون أمير - مينا سامى - كيرلس ياسر', 'مارك مجدي', '01221230379', null, 7),

  ('بيشوى جمال', 'مينا باسم', '01003445151', 'اخوات', 1),
  ('بيشوى جمال', 'ايمانويل باسم', '01003445151', 'اخوات', 2),
  ('بيشوى جمال', 'باڤلي مينا', '01279566889 - 01227776958', null, 3),
  ('بيشوى جمال', 'كاراس اسحق', '01275493588', null, 4),
  ('بيشوى جمال', 'روچيه جرجس', '01220714724 - 01032138409', null, 5),

  ('مارك ماجد - كيرلس هانى', 'جوناثان جون', '01220496996', null, 1),
  ('مارك ماجد - كيرلس هانى', 'جرجس كيرلس', '01050599220', null, 2),
  ('مارك ماجد - كيرلس هانى', 'كيرلس ملاك', '01279503682', null, 3),
  ('مارك ماجد - كيرلس هانى', 'دانيال عادل', '01023781220', null, 4),
  ('مارك ماجد - كيرلس هانى', 'بشمونة مينا', '01277725754', null, 5),
  ('مارك ماجد - كيرلس هانى', 'مجدى اسحق', '01277477776', null, 6),
  ('مارك ماجد - كيرلس هانى', 'كريستيانو امير', '01223168679', null, 7),

  ('جورج جمال - كيرلس يسري', 'داود مايكل', '01228437519', null, 1),
  ('جورج جمال - كيرلس يسري', 'كريستيفن عادل', '01220192815', null, 2),

  ('فادى ميشيل - جون عماد', 'دانيال هاني شوقي', '01003196779', null, 1),
  ('فادى ميشيل - جون عماد', 'فيلوباتير جرجس فايز', '01279035234', null, 2),
  ('فادى ميشيل - جون عماد', 'بافلي ابانوب', '01286215988', 'رقم ماما', 3),
  ('فادى ميشيل - جون عماد', 'كيفين جوزيف', '01505589099', null, 4),
  ('فادى ميشيل - جون عماد', 'ماثيو مجدي', '01067793137', null, 5),
  ('فادى ميشيل - جون عماد', 'ماثيو جوزيف شكيب', '01098948927', null, 6)
) as v (class_name, child, phone, note, pos)
join khedma.mass_classes c on c.name = v.class_name
where not exists (select 1 from khedma.mass_children x where x.class_id = c.id);
