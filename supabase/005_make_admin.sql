-- Run ONCE in Supabase SQL Editor, after 004, to make the first admin.
-- After that, admins make other admins from the Users page inside the app.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'george.nabil.biy@gmail.com';

-- Check (should show role = admin):
select email, raw_app_meta_data ->> 'role' as role
from auth.users
where email = 'george.nabil.biy@gmail.com';

-- If you were already signed in to the app, sign out and in again for the role to apply.
