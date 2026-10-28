# خدمة 2027 — Khedma 2027

Children records for the class, متابعة (weekly Friday attendance and visits), and an audit log. Data lives in the `khedma_2027` schema of the **all-my-database** Supabase project. The app works offline as an installable PWA, in Arabic or English, with light and dark themes.

## Database setup

Run these once, in order, in the Supabase SQL Editor:

1. `supabase/002_offline_sync.sql` adds a stable `client_id` and auto `updated_at`, used for offline sync and conflict detection.
2. `supabase/003_phones_and_custom_fields.sql` adds multiple phones per person with a WhatsApp flag, the main contact, and custom columns.
3. `supabase/004_audit_admin_follow_up.sql` adds the audit log, the admin role, and the متابعة table (الحضور + الافتقاد).
4. `supabase/keepalive.sql` adds the `ping()` function used by the GitHub Action.
5. `supabase/005_make_admin.sql` makes george.nabil.biy@gmail.com the first admin (run once). After that, admins make other admins from the **Users** page.
6. `supabase/006_classes_and_sharing.sql` adds classes, membership and one-time share codes. Before running it, put your class name on the line marked `CLASS NAME`.
7. `supabase/007_photos_and_profiles.sql` adds an optional photo per child, and a profile (name + photo) per servant.
8. `supabase/008_app_users.sql` keeps Khedma's own list of accounts. Sign-in accounts are shared with other apps in this Supabase project, so only accounts that signed up from Khedma or were created by a Khedma admin can use the app or appear on the Users page.

Anyone can create an account from the sign-in page, but a new account sees no children until it creates a class or joins one with a share code. Turn on **Allow new users to sign up** in Supabase only **after** running 006. The admin can also add servants from the **Users** page.

## Admin Edge Function

The Users page creates, edits and deletes accounts through the `khedma-admin-users` Edge Function (the project also has an `admin-users` function — that one belongs to bishoy-saber-notes, never touch it). The function holds the service key, so the browser never does. To deploy it:

1. Supabase Dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `khedma-admin-users`.
3. Paste `supabase/functions/khedma-admin-users/index.ts` and click **Deploy**.

## Run locally

1. `cp .env.example .env`, then fill in the URL and the anon (publishable) key.
2. `npm install`
3. `npm run dev`, then open http://localhost:5173

## Keep-alive (GitHub Actions)

`.github/workflows/supabase-keepalive.yml` pings the project every 3 days so the free project never pauses. It needs these two repo secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Never put the `service_role` / secret key in `.env` or in GitHub secrets.
