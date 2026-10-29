-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 015.
-- Trips (الرحلات) of a class: where, when, where to gather, the price (and a lower one for
-- إخوة الرب), which children are going, and what each of them has paid — in as many
-- instalments as needed. Members of the class read and edit them, like its children.

-- =====================================================================
-- 1) Tables
-- =====================================================================
create table if not exists khedma.trips (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references khedma.classes (id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  place          text,
  trip_date      date,
  gather_time    time,
  gather_place   text,
  return_time    time,
  price          numeric(10, 2) check (price is null or price >= 0),
  brothers_price numeric(10, 2) check (brothers_price is null or brothers_price >= 0), -- سعر إخوة الرب
  notes          text,
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists trips_class_idx on khedma.trips (class_id, trip_date);

-- A child going on a trip. `brothers` = one of إخوة الرب, so pays brothers_price.
create table if not exists khedma.trip_children (
  trip_id         uuid not null references khedma.trips (id) on delete cascade,
  child_client_id uuid not null references khedma.children (client_id) on delete cascade,
  brothers        boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (trip_id, child_client_id)
);

-- One instalment. Removing the child from the trip removes their payments too.
create table if not exists khedma.trip_payments (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null,
  child_client_id uuid not null,
  amount          numeric(10, 2) not null check (amount > 0),
  paid_on         date not null default (now() at time zone 'Africa/Cairo')::date,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  foreign key (trip_id, child_client_id) references khedma.trip_children (trip_id, child_client_id) on delete cascade
);
create index if not exists trip_payments_trip_idx on khedma.trip_payments (trip_id);

-- =====================================================================
-- 2) Who can see / change them: members of the trip's class (admins see all, via is_member)
-- =====================================================================
alter table khedma.trips enable row level security;
alter table khedma.trip_children enable row level security;
alter table khedma.trip_payments enable row level security;
revoke all on khedma.trips, khedma.trip_children, khedma.trip_payments from anon;
grant select, insert, update, delete on khedma.trips, khedma.trip_children, khedma.trip_payments to authenticated;

create or replace function khedma.is_trip_member(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from khedma.trips t where t.id = p_trip and khedma.is_member(t.class_id))
$$;
revoke all on function khedma.is_trip_member(uuid) from public, anon;
grant execute on function khedma.is_trip_member(uuid) to authenticated;

drop policy if exists "members use trips" on khedma.trips;
create policy "members use trips" on khedma.trips for all to authenticated
  using (khedma.is_member(class_id)) with check (khedma.is_member(class_id));

drop policy if exists "members use trip children" on khedma.trip_children;
create policy "members use trip children" on khedma.trip_children for all to authenticated
  using (khedma.is_trip_member(trip_id)) with check (khedma.is_trip_member(trip_id));

drop policy if exists "members use trip payments" on khedma.trip_payments;
create policy "members use trip payments" on khedma.trip_payments for all to authenticated
  using (khedma.is_trip_member(trip_id)) with check (khedma.is_trip_member(trip_id));

drop trigger if exists trips_touch_updated_at on khedma.trips;
create trigger trips_touch_updated_at
  before update on khedma.trips
  for each row execute function khedma.touch_updated_at();

-- =====================================================================
-- 3) Audit: same function as in 010, plus ids for the three trip tables
-- =====================================================================
create or replace function khedma.audit_trigger()
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
    when 'trips'           then v_row ->> 'id'
    when 'trip_children'   then (v_row ->> 'trip_id') || '@' || (v_row ->> 'child_client_id')
    when 'trip_payments'   then v_row ->> 'id'
    else v_row ->> 'client_id'
  end;

  insert into khedma.audit_log (user_id, user_email, action, table_name, record_id, old_data, new_data, changed_fields)
  values (auth.uid(), auth.jwt() ->> 'email', lower(tg_op), tg_table_name, v_id, v_old, v_new, v_changed);

  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_trips on khedma.trips;
create trigger audit_trips after insert or update or delete on khedma.trips
  for each row execute function khedma.audit_trigger();
drop trigger if exists audit_trip_children on khedma.trip_children;
create trigger audit_trip_children after insert or update or delete on khedma.trip_children
  for each row execute function khedma.audit_trigger();
drop trigger if exists audit_trip_payments on khedma.trip_payments;
create trigger audit_trip_payments after insert or update or delete on khedma.trip_payments
  for each row execute function khedma.audit_trigger();
