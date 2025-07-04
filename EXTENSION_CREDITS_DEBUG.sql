-- ==========================================
-- EXTENSION CREDITS DEBUG INVESTIGATION
-- ==========================================
-- Debug why credits weren't available during extension

-- 1. Check current user's credit status
SELECT 
    u.email,
    p.credits as current_credits,
    p.id as profile_id,
    u.id as user_id,
    -- Recent credit transactions
    (SELECT COUNT(*) FROM credit_transactions ct WHERE ct.user_id = u.id AND ct.created_at > NOW() - INTERVAL '1 hour') as recent_credit_transactions,
    -- Check if profile exists and is accessible
    CASE WHEN p.id IS NOT NULL THEN 'PROFILE_EXISTS' ELSE 'PROFILE_MISSING' END as profile_status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'redis213+creditstest@gmail.com';

-- 2. Check recent credit transactions around extension time
SELECT 
    ct.id,
    ct.user_id,
    ct.booking_id,
    ct.amount,
    ct.new_balance,
    ct.transaction_type,
    ct.notes,
    ct.created_at,
    -- Compare with extension time
    CASE 
        WHEN ct.created_at BETWEEN '2025-07-04 12:44:00'::timestamptz AND '2025-07-04 12:46:00'::timestamptz 
        THEN 'DURING_EXTENSION' 
        ELSE 'OTHER_TIME' 
    END as timing_relation
FROM credit_transactions ct
JOIN auth.users u ON ct.user_id = u.id
WHERE u.email = 'redis213+creditstest@gmail.com'
ORDER BY ct.created_at DESC
LIMIT 10;

-- 3. Verify the specific booking's credit usage
SELECT 
    b.id as booking_id,
    b.credits_used,
    b.total_price,
    b.created_at as booking_created,
    b.updated_at as booking_updated,
    -- Calculate what credits should be available now
    p.credits as current_user_credits,
    -- Extension payment info
    ext_p.amount_paid as extension_payment,
    ext_p.created_at as extension_payment_created
FROM bookings b
JOIN profiles p ON b.user_id = p.id
LEFT JOIN payments ext_p ON b.id = ext_p.booking_id AND ext_p.payment_type = 'extension'
WHERE b.id = '985d7ba2-ba36-4d40-91e8-a36ad12f9b5e';

-- 4. Check if there are any RLS (Row Level Security) issues
-- This would show if the user can actually access their profile data
SELECT 
    'RLS_TEST' as test_type,
    p.id,
    p.email,
    p.credits,
    p.created_at
FROM profiles p
WHERE p.id = '6c405e35-3818-4f62-8b7d-08b3c0f738fd';

-- 5. Check for any authentication/session issues around extension time
-- Look for potential auth token or session problems
SELECT 
    u.id,
    u.email,
    u.created_at as user_created,
    u.updated_at as user_updated,
    u.last_sign_in_at,
    u.email_confirmed_at,
    -- Check recent activity
    CASE 
        WHEN u.last_sign_in_at > NOW() - INTERVAL '2 hours' 
        THEN 'RECENT_SESSION' 
        ELSE 'OLD_SESSION' 
    END as session_status
FROM auth.users u
WHERE u.id = '6c405e35-3818-4f62-8b7d-08b3c0f738fd';

-- 6. Double-check the extension timing and credit state
-- See if credits were available before the extension
SELECT 
    'EXTENSION_TIMELINE' as event_type,
    '2025-07-04 12:45:24'::timestamptz as extension_time,
    p.credits as credits_at_query_time,
    (
        SELECT ct.new_balance 
        FROM credit_transactions ct 
        WHERE ct.user_id = p.id 
        AND ct.created_at <= '2025-07-04 12:45:00'::timestamptz
        ORDER BY ct.created_at DESC 
        LIMIT 1
    ) as credits_before_extension,
    (
        SELECT COUNT(*) 
        FROM credit_transactions ct 
        WHERE ct.user_id = p.id 
        AND ct.created_at BETWEEN '2025-07-04 12:45:00'::timestamptz AND '2025-07-04 12:46:00'::timestamptz
    ) as credit_transactions_during_extension
FROM profiles p
WHERE p.id = '6c405e35-3818-4f62-8b7d-08b3c0f738fd';

-- ==========================================
-- DEBUGGING QUESTIONS TO ANSWER:
-- ==========================================
-- 1. Did the user have 299+ credits available at extension time?
-- 2. Are there any RLS/permission issues preventing credit access?
-- 3. Was there a session/auth issue during extension?
-- 4. Did the useCredits hook fail to load credits properly?
-- 5. Was creditsEnabled accidentally set to false in the UI?
-- ========================================== 