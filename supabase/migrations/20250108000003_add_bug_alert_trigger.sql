-- Bug Alert Trigger Migration
-- This creates a trigger that automatically sends email alerts when new bugs are reported

-- Enable the pg_net extension for HTTP requests (Supabase has this by default)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- First, create the function that will call the email service
CREATE OR REPLACE FUNCTION notify_bug_alert()
RETURNS TRIGGER AS $$
DECLARE
  user_email_address TEXT;
  payload JSON;
  supabase_url TEXT;
  service_key TEXT;
  request_id BIGINT;
BEGIN
  -- Get configuration
  supabase_url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'http://127.0.0.1:54321'
  );
  
  service_key := COALESCE(
    current_setting('app.settings.service_role_key', true),
    current_setting('app.settings.supabase_service_role_key', true),
    'dummy-key'
  );

  -- Get user email if user_id exists
  IF NEW.user_id IS NOT NULL THEN
    SELECT email INTO user_email_address 
    FROM auth.users 
    WHERE id = NEW.user_id;
  END IF;

  -- Build the payload for the email function
  payload := json_build_object(
    'bugId', NEW.id::text,
    'description', NEW.description,
    'steps_to_reproduce', NEW.steps_to_reproduce,
    'page_url', NEW.page_url,
    'status', NEW.status,
    'user_id', NEW.user_id::text,
    'user_email', user_email_address,
    'image_urls', NEW.image_urls,
    'created_at', NEW.created_at::text
  );

  -- Call the email function asynchronously using pg_net
  -- This won't block the INSERT operation if the email fails
  SELECT INTO request_id
    net.http_post(
      url := supabase_url || '/functions/v1/send-bug-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := payload::jsonb
    );

  -- Optionally log the request ID for debugging
  RAISE LOG 'Bug alert email triggered for bug % with request ID %', NEW.id, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the INSERT if email sending fails
    -- Just log the error and continue
    RAISE LOG 'Bug alert email failed for bug %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger that fires after every INSERT on bug_reports
DROP TRIGGER IF EXISTS bug_alert_trigger ON bug_reports;

CREATE TRIGGER bug_alert_trigger
  AFTER INSERT ON bug_reports
  FOR EACH ROW 
  EXECUTE FUNCTION notify_bug_alert();

-- Add comment for documentation
COMMENT ON TRIGGER bug_alert_trigger ON bug_reports IS 
'Automatically sends email alerts to redis213@gmail.com when new bugs are reported. Uses send-bug-alert edge function.';

COMMENT ON FUNCTION notify_bug_alert() IS 
'Trigger function that calls the send-bug-alert edge function to email bug reports to redis213@gmail.com. Includes full bug details and user information.'; 