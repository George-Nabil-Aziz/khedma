-- Run AFTER creating the user in Supabase → Authentication → Users → Add user
-- (with "Auto Confirm User" checked). Never store the password in this repo.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'admin@admin.com';

-- Check (should return one row with role = admin):
select email, raw_app_meta_data ->> 'role' as role from auth.users where email = 'admin@admin.com';

-- The admin must sign out and sign in again for the new role to take effect.
