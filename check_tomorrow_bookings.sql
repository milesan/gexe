-- Check bookings for tomorrow and their reminder status
SELECT 
  b.id,
  b.check_in,
  b.user_email,
  b.reminder_email_sent,
  b.status,
  CURRENT_DATE as today,
  b.check_in::date - CURRENT_DATE as days_until_checkin,
  CASE 
    WHEN b.check_in::date - CURRENT_DATE = 1 THEN 'Check-in tomorrow - NO REMINDER WILL BE SENT'
    WHEN b.check_in::date - CURRENT_DATE = 2 THEN 'Check-in day after tomorrow - NO REMINDER WILL BE SENT'
    WHEN b.check_in::date - CURRENT_DATE = 3 THEN 'Check-in in 3 days - REMINDER WILL BE SENT TODAY'
    ELSE 'Other'
  END as reminder_status
FROM bookings_with_emails b
WHERE b.check_in::date - CURRENT_DATE IN (1, 2, 3)
  AND b.status != 'cancelled'
  AND b.user_email IS NOT NULL
ORDER BY b.check_in;

-- Check what the function would actually find today
SELECT 
  'Function target date (3 days from today):' as info,
  CURRENT_DATE + INTERVAL '3 days' as target_date;

-- Show bookings that would be missed by current logic
SELECT 
  b.id,
  b.check_in,
  b.user_email,
  b.reminder_email_sent,
  b.status,
  b.check_in::date - CURRENT_DATE as days_until_checkin,
  'MISSED - Will not receive reminder' as issue
FROM bookings_with_emails b
WHERE b.check_in::date - CURRENT_DATE IN (1, 2)
  AND b.reminder_email_sent = false
  AND b.status != 'cancelled'
  AND b.user_email IS NOT NULL
ORDER BY b.check_in; 