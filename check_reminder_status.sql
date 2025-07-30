-- Check the current reminder email status for the test booking
SELECT 
  id,
  check_in,
  user_email,
  reminder_email_sent,
  status,
  updated_at,
  CURRENT_TIMESTAMP as current_time
FROM bookings_with_emails 
WHERE id = '40824c6e-8d59-40bc-b128-c2a6722565ee';

-- Check all bookings that should have received reminders recently
SELECT 
  id,
  check_in,
  user_email,
  reminder_email_sent,
  status,
  updated_at,
  CURRENT_DATE as today,
  check_in::date - CURRENT_DATE as days_until_checkin
FROM bookings_with_emails 
WHERE check_in::date >= CURRENT_DATE
  AND check_in::date <= CURRENT_DATE + INTERVAL '3 days'
  AND status != 'cancelled'
  AND user_email IS NOT NULL
ORDER BY check_in;

-- Check if any reminders were sent in the last hour
SELECT 
  COUNT(*) as reminders_sent_recently
FROM bookings_with_emails 
WHERE reminder_email_sent = true
  AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'; 