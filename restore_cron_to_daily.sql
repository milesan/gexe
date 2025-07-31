-- Restore the arrival reminder cron job to daily schedule (8 AM UTC)
-- This reverts from the testing schedule (every minute) back to production

-- First, unschedule the testing job
SELECT cron.unschedule('send-arrival-reminder-testing');

-- Then schedule the production job with daily schedule
SELECT cron.schedule(
  'send-arrival-reminder-daily',
  '0 8 * * *',  -- Daily at 8 AM UTC (changed from '* * * * *')
  'select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = ''project_url'') || ''/functions/v1/send-arrival-reminder'',
      headers := jsonb_build_object(
        ''Content-type'', ''application/json'',
        ''Authorization'', ''Bearer '' || (select decrypted_secret from vault.decrypted_secrets where name = ''anon_key'')
      ),
      body := ''{}''::jsonb
    ) as request_id;'
);

-- Verify the change
SELECT
  jobid,
  schedule,
  command,
  jobname,
  active,
  database,
  username
FROM cron.job
WHERE jobname LIKE '%arrival%' OR jobname LIKE '%reminder%'
ORDER BY jobid; 