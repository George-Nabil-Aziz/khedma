-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 025.
-- Birthday notifications: each servant picks when to be reminded (الإعدادات → التنبيهات), and
-- turns notifications on per device. The Edge Function khedma-birthdays sends them; 027 runs it
-- every hour.

-- =====================================================================
-- 1) Devices that receive notifications (one row per browser / installed app)
-- =====================================================================
create table if not exists khedma.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on khedma.push_subscriptions (user_id);

alter table khedma.push_subscriptions enable row level security;
revoke all on khedma.push_subscriptions from anon;
grant select, insert, update, delete on khedma.push_subscriptions to authenticated;

drop policy if exists "own devices" on khedma.push_subscriptions;
create policy "own devices" on khedma.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- 2) When each servant wants to be reminded
--    reminders: [{"when": "friday_before" | "week_before" | "two_days_before" | "day_before" | "same_day",
--                 "time": "HH:MM"}]  — Cairo time.
-- =====================================================================
create table if not exists khedma.notification_settings (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  reminders  jsonb not null default '[]' check (jsonb_typeof(reminders) = 'array' and jsonb_array_length(reminders) <= 10),
  lang       text not null default 'ar' check (lang in ('ar', 'en')),
  updated_at timestamptz not null default now()
);

alter table khedma.notification_settings enable row level security;
revoke all on khedma.notification_settings from anon;
grant select, insert, update on khedma.notification_settings to authenticated;

drop policy if exists "own settings" on khedma.notification_settings;
create policy "own settings" on khedma.notification_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists notification_settings_touch_updated_at on khedma.notification_settings;
create trigger notification_settings_touch_updated_at
  before update on khedma.notification_settings
  for each row execute function khedma.touch_updated_at();

-- =====================================================================
-- 3) What was already sent, so a reminder never goes out twice.
--    Only the Edge Function (service key) touches it: RLS on, no policies.
-- =====================================================================
create table if not exists khedma.notification_log (
  user_id         uuid not null references auth.users (id) on delete cascade,
  child_client_id uuid not null,
  reminder        text not null,
  birthday        date not null,
  sent_at         timestamptz not null default now(),
  primary key (user_id, child_client_id, reminder, birthday)
);

alter table khedma.notification_log enable row level security;
revoke all on khedma.notification_log from anon, authenticated;

-- =====================================================================
-- 4) The Edge Function runs with the service key: what it reads and writes
-- =====================================================================
grant usage on schema khedma to service_role;
grant select on khedma.children, khedma.classes, khedma.class_members to service_role;
grant select, insert, update, delete on khedma.push_subscriptions, khedma.notification_settings, khedma.notification_log to service_role;
