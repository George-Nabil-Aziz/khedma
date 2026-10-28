-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 009.
-- Marks a Friday as a communion day (يوم تناول) for a class, from the متابعة grid.
-- One row per class per Friday; shared by every member of the class.

create table if not exists khedma_2027.class_day_marks (
  class_id   uuid not null references khedma_2027.classes (id) on delete cascade,
  date       date not null,
  communion  boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (class_id, date)
);

alter table khedma_2027.class_day_marks enable row level security;
revoke all on khedma_2027.class_day_marks from anon;

drop policy if exists "members read day marks" on khedma_2027.class_day_marks;
drop policy if exists "members add day marks"  on khedma_2027.class_day_marks;
drop policy if exists "members edit day marks" on khedma_2027.class_day_marks;
create policy "members read day marks" on khedma_2027.class_day_marks for select to authenticated using (khedma_2027.is_member(class_id));
create policy "members add day marks"  on khedma_2027.class_day_marks for insert to authenticated with check (khedma_2027.is_member(class_id));
create policy "members edit day marks" on khedma_2027.class_day_marks for update to authenticated using (khedma_2027.is_member(class_id)) with check (khedma_2027.is_member(class_id));

drop trigger if exists class_day_marks_touch_updated_at on khedma_2027.class_day_marks;
create trigger class_day_marks_touch_updated_at
  before update on khedma_2027.class_day_marks
  for each row execute function khedma_2027.touch_updated_at();

-- Audit: same function as before, plus an id for day marks (class@date).
create or replace function khedma_2027.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  v_row     jsonb;
  v_id      text;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_changed
    from jsonb_each(v_new) n
    where n.value is distinct from v_old -> n.key
      and n.key <> 'updated_at';
    if v_changed is null then return new; end if;
  end if;

  v_old := v_old - 'photo';
  v_new := v_new - 'photo';

  v_row := coalesce(v_new, v_old);
  v_id := case tg_table_name
    when 'follow_up'       then (v_row ->> 'child_client_id') || '@' || (v_row ->> 'date') || '@' || (v_row ->> 'kind')
    when 'custom_fields'   then v_row ->> 'key'
    when 'classes'         then v_row ->> 'id'
    when 'class_members'   then (v_row ->> 'class_id') || '@' || (v_row ->> 'user_id')
    when 'class_day_marks' then (v_row ->> 'class_id') || '@' || (v_row ->> 'date')
    when 'profiles'        then v_row ->> 'user_id'
    else v_row ->> 'client_id'
  end;

  insert into khedma_2027.audit_log (user_id, user_email, action, table_name, record_id, old_data, new_data, changed_fields)
  values (auth.uid(), auth.jwt() ->> 'email', lower(tg_op), tg_table_name, v_id, v_old, v_new, v_changed);

  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_class_day_marks on khedma_2027.class_day_marks;
create trigger audit_class_day_marks
  after insert or update or delete on khedma_2027.class_day_marks
  for each row execute function khedma_2027.audit_trigger();
