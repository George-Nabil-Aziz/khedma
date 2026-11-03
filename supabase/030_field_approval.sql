-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 029, and BEFORE the app update
-- (the app now asks for these columns — without them the extra columns fail to load).
-- An extra column a servant adds waits for an admin (pending): until then only the servant who
-- added it sees it. An admin approves it — then the whole class sees it — or deletes it.
-- Columns an admin adds, and every column there already is, count as approved.

alter table khedma.custom_fields
  add column if not exists approved   boolean not null default true,
  add column if not exists created_by uuid default auth.uid() references auth.users (id) on delete set null;

-- Who added it and whether it waits are set here, not by the app; only an admin approves.
create or replace function khedma.custom_field_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.approved := khedma.is_admin();
  else
    new.created_by := old.created_by;
    if new.approved is distinct from old.approved and not khedma.is_admin() then
      raise exception 'admins only';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists custom_field_guard on khedma.custom_fields;
create trigger custom_field_guard
  before insert or update on khedma.custom_fields
  for each row execute function khedma.custom_field_guard();

-- A pending column: only the servant who added it, and admins, see it (and can rename it).
drop policy if exists "members read fields" on khedma.custom_fields;
drop policy if exists "members edit fields" on khedma.custom_fields;
create policy "members read fields" on khedma.custom_fields for select to authenticated
  using (khedma.is_member(class_id) and (approved or created_by = auth.uid() or khedma.is_admin()));
create policy "members edit fields" on khedma.custom_fields for update to authenticated
  using (khedma.is_member(class_id) and (approved or created_by = auth.uid() or khedma.is_admin()))
  with check (khedma.is_member(class_id));

-- Deleting: admins any column; a servant their own column while it still waits.
create or replace function khedma.delete_custom_field(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class uuid;
  v_approved boolean;
  v_by uuid;
begin
  select class_id, approved, created_by into v_class, v_approved, v_by from khedma.custom_fields where key = p_key;
  if not found then return; end if;
  if not khedma.is_admin() and (v_approved or v_by is distinct from auth.uid()) then
    raise exception 'admins only';
  end if;
  update khedma.children set extra = extra - p_key where class_id = v_class and extra ? p_key;
  delete from khedma.custom_fields where key = p_key;
end;
$$;

revoke all on function khedma.delete_custom_field(text) from public, anon;
grant execute on function khedma.delete_custom_field(text) to authenticated;
