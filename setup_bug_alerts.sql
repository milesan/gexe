-- Setup Bug Alert System
-- Run this after deploying the functions and migration

-- First, set the configuration for the trigger function
-- Replace these values with your actual Supabase settings

-- For production - UPDATE WITH YOUR ACTUAL SERVICE ROLE KEY
SELECT set_config('app.settings.supabase_url', 'https://guquxpxxycfmmlqajdyw.supabase.co', false);
-- Uncomment and add your service role key:
-- SELECT set_config('app.settings.service_role_key', 'your-actual-service-role-key-here', false);

-- For local development (commented out)
-- SELECT set_config('app.settings.supabase_url', 'http://127.0.0.1:54321', false);

-- Test the trigger by inserting a test bug report
-- (Remove this after testing)
/*
INSERT INTO bug_reports (
  user_id, 
  description, 
  steps_to_reproduce, 
  page_url, 
  status
) VALUES (
  NULL, -- System generated test
  'Test bug alert system - this is a test bug report to verify email alerts are working',
  '1. Deploy bug alert system\n2. Run this test\n3. Check redis213@gmail.com for email',
  '/test',
  'new'
);
*/

-- Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'bug_alert_trigger'
  AND event_object_table = 'bug_reports';

-- Check if the function exists
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'notify_bug_alert'
  AND routine_schema = 'public';

-- View recent bug reports to verify structure
SELECT 
  id,
  created_at,
  status,
  description,
  user_id,
  page_url
FROM bug_reports 
ORDER BY created_at DESC 
LIMIT 5;

RAISE NOTICE 'Bug alert system setup complete. Emails will be sent to redis213@gmail.com for all new bug reports.'; 