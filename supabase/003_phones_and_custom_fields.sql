-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 002_offline_sync.sql.
-- Adds: several phone numbers per person with a WhatsApp flag, a "main contact" flag,
-- and columns you can add yourself from the app. Nothing is deleted.

-- 1) New columns on children
alter table khedma_2027.children
  add column if not exists phones jsonb not null default '[]'::jsonb,
  add column if not exists primary_contact text check (primary_contact in ('mother', 'father', 'child')),
  add column if not exists extra jsonb not null default '{}'::jsonb;

-- 2) Copy the old mobile columns into phones.
--    A cell with several numbers ("0100... / 0122...") becomes several entries.
--    Safe to re-run: only touches children whose phones list is still empty
--    (e.g. after importing a new CSV with mother_mobile / father_mobile / child_mobile).
update khedma_2027.children c
set phones = coalesce((
  select jsonb_agg(jsonb_build_object('owner', s.owner, 'number', s.number, 'whatsapp', false) order by s.ord, s.n)
  from (
    select o.owner, o.ord, n.n, trim(n.number) as number
    from (values ('mother', 1, c.mother_mobile), ('father', 2, c.father_mobile), ('child', 3, c.child_mobile)) as o(owner, ord, cell)
    cross join lateral regexp_split_to_table(coalesce(o.cell, ''), '\s*[/,،|\n]\s*|\s+-\s+') with ordinality as n(number, n)
  ) s
  where s.number <> ''
), '[]'::jsonb)
where c.phones = '[]'::jsonb;

-- 3) Definitions of the columns you add from the app ("تعديل الأعمدة")
create table if not exists khedma_2027.custom_fields (
  key        text primary key,
  label      text not null,
  type       text not null check (type in ('text', 'number', 'date', 'boolean')),
  position   int not null default 0,
  created_at timestamptz not null default now()
);

alter table khedma_2027.custom_fields enable row level security;
revoke all on khedma_2027.custom_fields from anon;

drop policy if exists "servants can read fields" on khedma_2027.custom_fields;
drop policy if exists "servants can add fields" on khedma_2027.custom_fields;
drop policy if exists "servants can edit fields" on khedma_2027.custom_fields;
drop policy if exists "servants can delete fields" on khedma_2027.custom_fields;

create policy "servants can read fields"
  on khedma_2027.custom_fields for select to authenticated using (true);
create policy "servants can add fields"
  on khedma_2027.custom_fields for insert to authenticated with check (true);
create policy "servants can edit fields"
  on khedma_2027.custom_fields for update to authenticated using (true) with check (true);
create policy "servants can delete fields"
  on khedma_2027.custom_fields for delete to authenticated using (true);

-- 4) Check: every child and the phones copied from the old columns
-- select full_name, mother_mobile, father_mobile, child_mobile, phones from khedma_2027.children;

-- 5) LATER, once you have checked the phones look right, you can drop the old columns:
-- alter table khedma_2027.children drop column mother_mobile, drop column father_mobile, drop column child_mobile;
