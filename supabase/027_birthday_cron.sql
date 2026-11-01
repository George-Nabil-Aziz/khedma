-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 026 and AFTER deploying the
-- Edge Function khedma-birthdays (see README → Birthday notifications).
-- Calls the function every hour, on the hour; it sends whatever reminders are due.
--
-- ⚠️ BEFORE RUNNING: replace the two placeholders below —
--   <PROJECT-REF>  the part before .supabase.co in your project URL
--   <CRON_SECRET>  the same CRON_SECRET you saved in Edge Functions → Secrets
-- Don't save the file with the real secret in it.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- running it again replaces the job instead of adding a second one
select cron.unschedule('khedma-birthdays') where exists (select 1 from cron.job where jobname = 'khedma-birthdays');

select cron.schedule(
  'khedma-birthdays',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT-REF>.supabase.co/functions/v1/khedma-birthdays',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);

-- Check: the last runs (status 200 = fine)
--   select status_code, content, created from net._http_response order by created desc limit 5;
