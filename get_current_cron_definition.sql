-- Get the exact current cron job definition for arrival reminder
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