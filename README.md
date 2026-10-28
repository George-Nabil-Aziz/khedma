# خدمة 2027 — Khedma 2027

Reads `khedma_2027.children` from the **all-my-database** Supabase project. Arabic / English, dark / light.

## Setup

1. `cp .env.example .env`, then fill in the URL and anon (publishable) key from Supabase → Project Settings → API.
2. `npm install`
3. `npm run dev`, then open http://localhost:5173
4. Sign in with a servant account created in Supabase → Authentication → Users (sign-ups are disabled).

## Keep-alive (GitHub Actions)

Free Supabase projects pause after 7 days of inactivity. `.github/workflows/supabase-keepalive.yml` pings the project every 3 days.

1. Run `supabase/keepalive.sql` once in the Supabase SQL Editor.
2. In the GitHub repo, open Settings → Secrets and variables → Actions and add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Open Actions → **Supabase keep-alive** → **Run workflow** to test it once.

Never put the `service_role` key in `.env` or in GitHub secrets for this app.
