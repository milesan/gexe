-- Test the new logic: bookings within next 3 days
SELECT 
  'NEW LOGIC TEST' as test_type,
  b.id,
  b.check_in,
  b.user_email,
  b.reminder_email_sent,
  b.status,
  CURRENT_DATE as today,
  b.check_in::date - CURRENT_DATE as days_until_checkin,
  CASE 
    WHEN b.check_in::date - CURRENT_DATE = 1 THEN 'Check-in tomorrow - WILL GET REMINDER'
    WHEN b.check_in::date - CURRENT_DATE = 2 THEN 'Check-in day after tomorrow - WILL GET REMINDER'
    WHEN b.check_in::date - CURRENT_DATE = 3 THEN 'Check-in in 3 days - WILL GET REMINDER'
    ELSE 'Other'
  END as reminder_status
FROM bookings_with_emails b
WHERE b.check_in::date >= CURRENT_DATE
  AND b.check_in::date <= CURRENT_DATE + INTERVAL '3 days'
  AND b.reminder_email_sent = false
  AND b.status != 'cancelled'
  AND b.user_email IS NOT NULL
ORDER BY b.check_in;

-- Compare with old logic (exactly 3 days)
SELECT 
  'OLD LOGIC TEST' as test_type,
  b.id,
  b.check_in,
  b.user_email,
  b.reminder_email_sent,
  b.status,
  CURRENT_DATE as today,
  b.check_in::date - CURRENT_DATE as days_until_checkin,
  'Only 3 days away bookings' as reminder_status
FROM bookings_with_emails b
WHERE b.check_in::date = CURRENT_DATE + INTERVAL '3 days'
  AND b.reminder_email_sent = false
  AND b.status != 'cancelled'
  AND b.user_email IS NOT NULL
ORDER BY b.check_in; 