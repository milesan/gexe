-- Update the arrival reminder cron job to run every minute for testing
-- Preserving the exact original command and settings
SELECT cron.unschedule('send-arrival-reminder-daily');

SELECT cron.schedule(
  'send-arrival-reminder-testing',
  '* * * * *',  -- Every minute (changed from '0 8 * * *')
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

-- Verify the new schedule
SELECT 
  jobid,
  schedule,
  jobname,
  active,
  database,
  username
FROM cron.job 
WHERE jobname LIKE '%arrival%' OR jobname LIKE '%reminder%'
ORDER BY jobid; 