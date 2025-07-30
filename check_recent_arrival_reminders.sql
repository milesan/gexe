-- Check recent bookings that should have received arrival reminders
SELECT 
  b.id,
  b.check_in,
  b.user_email,
  b.reminder_email_sent,
  b.status,
  CURRENT_DATE as today,
  b.check_in::date - CURRENT_DATE as days_until_checkin,
  CASE 
    WHEN b.check_in::date - CURRENT_DATE = 3 THEN 'Should have received reminder today'
    WHEN b.check_in::date - CURRENT_DATE = 2 THEN 'Should receive reminder tomorrow'
    WHEN b.check_in::date - CURRENT_DATE = 1 THEN 'Should receive reminder day after tomorrow'
    WHEN b.check_in::date - CURRENT_DATE = 0 THEN 'Check-in today'
    WHEN b.check_in::date - CURRENT_DATE < 0 THEN 'Check-in in the past'
    ELSE 'Check-in more than 3 days away'
  END as reminder_status
FROM bookings_with_emails b
WHERE b.check_in::date - CURRENT_DATE <= 3
  AND b.check_in::date - CURRENT_DATE >= 0
  AND b.status != 'cancelled'
  AND b.user_email IS NOT NULL
ORDER BY b.check_in;

-- Check if any reminders were sent today
SELECT 
  COUNT(*) as reminders_sent_today
FROM bookings_with_emails b
WHERE b.reminder_email_sent = true
  AND b.updated_at::date = CURRENT_DATE;

-- Check recent reminder activity (last 7 days)
SELECT 
  DATE(b.updated_at) as reminder_date,
  COUNT(*) as reminders_sent
FROM bookings_with_emails b
WHERE b.reminder_email_sent = true
  AND b.updated_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(b.updated_at)
ORDER BY reminder_date DESC; 