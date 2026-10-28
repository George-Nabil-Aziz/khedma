# خدمة 2027 — Khedma 2027

Children records for the class, الافتقاد (weekly Friday follow-up), and an audit log. Data lives in the `khedma_2027` schema of the **all-my-database** Supabase project. The app works offline as an installable PWA, in Arabic or English, with light and dark themes.

## Database setup

Run these once, in order, in the Supabase SQL Editor:

1. `supabase/002_offline_sync.sql` adds a stable `client_id` and auto `updated_at`, used for offline sync and conflict detection.
2. `supabase/003_phones_and_custom_fields.sql` adds multiple phones per person with a WhatsApp flag, the main contact, and custom columns.
3. `supabase/004_audit_admin_attendance.sql` adds the audit log, the admin role, and the الافتقاد table.
4. `supabase/keepalive.sql` adds the `ping()` function used by the GitHub Action.
5. Create the admin user (Authentication → Users → Add user, with Auto Confirm checked), then run `supabase/005_make_admin.sql`.

Sign-ups are disabled. Add servants from Authentication → Users.

## Run locally

1. `cp .env.example .env`, then fill in the URL and the anon (publishable) key.
2. `npm install`
3. `npm run dev`, then open http://localhost:5173

## Keep-alive (GitHub Actions)

`.github/workflows/supabase-keepalive.yml` pings the project every 3 days so the free project never pauses. It needs these two repo secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Never put the `service_role` / secret key in `.env` or in GitHub secrets.
