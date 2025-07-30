-- Check existing cron jobs
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
ORDER BY jobid;

-- Check if there's a specific arrival reminder job
SELECT 
  jobid,
  schedule,
  command,
  jobname,
  active
FROM cron.job 
WHERE command LIKE '%arrival%' 
   OR command LIKE '%reminder%'
   OR jobname LIKE '%arrival%'
   OR jobname LIKE '%reminder%';

-- Check all jobs that might be related to emails or notifications
SELECT 
  jobid,
  schedule,
  command,
  jobname,
  active
FROM cron.job 
WHERE command LIKE '%email%' 
   OR command LIKE '%reminder%'
   OR command LIKE '%notification%'
   OR command LIKE '%send%'
ORDER BY jobid; 