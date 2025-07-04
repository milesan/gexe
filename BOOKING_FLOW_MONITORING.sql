-- ==========================================
-- BOOKING FLOW DATABASE MONITORING QUERIES
-- ==========================================
-- Use these queries to trace what's happening during the booking process
-- Filter console logs with [BOOKING_FLOW] to correlate with database changes

-- === 1. MONITOR PENDING PAYMENTS (Step 3) ===
-- Watch for new pending payment rows being created
SELECT 
    id,
    user_id,
    booking_id,
    start_date,
    end_date,
    amount_paid,
    status,
    payment_type,
    discount_code,
    stripe_payment_id,
    created_at,
    updated_at,
    (breakdown_json->>'accommodation')::numeric as accommodation_cost,
    (breakdown_json->>'food_facilities')::numeric as food_cost,
    (breakdown_json->>'credits_used')::numeric as credits_used
FROM payments 
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 5;

-- === 2. MONITOR BOOKING CREATION (Step 6) ===
-- Watch for new bookings being created
SELECT 
    id,
    user_id,
    accommodation_id,
    check_in,
    check_out,
    total_price,
    status,
    payment_intent_id,
    credits_used,
    applied_discount_code,
    accommodation_price,
    food_contribution,
    seasonal_adjustment,
    duration_discount_percent,
    discount_amount,
    accommodation_price_paid,
    created_at
FROM bookings 
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 5;

-- === 3. MONITOR PAYMENT UPDATES (Step 7) ===
-- Watch for pending payments being updated to 'paid'
SELECT 
    id,
    booking_id,
    status,
    stripe_payment_id,
    amount_paid,
    created_at,
    updated_at,
    CASE 
        WHEN updated_at > created_at + INTERVAL '1 second' THEN 'UPDATED'
        ELSE 'NEW'
    END as record_status
FROM payments 
WHERE updated_at > NOW() - INTERVAL '10 minutes'
ORDER BY updated_at DESC
LIMIT 5;

-- === 4. MONITOR CREDIT TRANSACTIONS (Step 8) ===
-- Watch for credit deductions when credits are used
SELECT 
    ct.id,
    ct.user_id,
    ct.booking_id,
    ct.amount,
    ct.new_balance,
    ct.transaction_type,
    ct.notes,
    ct.created_at,
    p.credits as current_profile_credits
FROM credit_transactions ct
JOIN profiles p ON ct.user_id = p.id
WHERE ct.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY ct.created_at DESC
LIMIT 5;

-- === 5. COMPREHENSIVE BOOKING + PAYMENT VIEW ===
-- Get the complete picture for recent bookings
SELECT 
    b.id as booking_id,
    b.check_in,
    b.check_out,
    b.total_price as booking_total,
    b.credits_used as booking_credits,
    b.status as booking_status,
    b.payment_intent_id,
    b.created_at as booking_created,
    
    p.id as payment_id,
    p.amount_paid as payment_amount,
    p.status as payment_status,
    p.stripe_payment_id,
    p.created_at as payment_created,
    p.updated_at as payment_updated,
    
    u.email as user_email,
    prof.credits as current_user_credits,
    
    acc.title as accommodation_name
FROM bookings b
LEFT JOIN payments p ON b.id = p.booking_id
LEFT JOIN auth.users u ON b.user_id = u.id
LEFT JOIN profiles prof ON b.user_id = prof.id
LEFT JOIN accommodations acc ON b.accommodation_id = acc.id
WHERE b.created_at > NOW() - INTERVAL '1 hour'
ORDER BY b.created_at DESC
LIMIT 10;

-- === 6. DETECT PAYMENT WITHOUT BOOKING ISSUES ===
-- Find payments that succeeded but don't have corresponding bookings
SELECT 
    p.id as payment_id,
    p.stripe_payment_id,
    p.amount_paid,
    p.status as payment_status,
    p.created_at as payment_created,
    p.updated_at as payment_updated,
    p.booking_id,
    b.id as actual_booking_id,
    CASE 
        WHEN p.booking_id IS NULL AND p.status = 'paid' THEN 'ORPHANED_PAYMENT'
        WHEN p.booking_id IS NOT NULL AND b.id IS NULL THEN 'INVALID_BOOKING_REF'
        ELSE 'OK'
    END as issue_status
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
WHERE p.created_at > NOW() - INTERVAL '1 hour'
AND (p.booking_id IS NULL OR b.id IS NULL)
ORDER BY p.created_at DESC;

-- === 7. ACTIVE MONITORING QUERY ===
-- Run this continuously during testing to see real-time changes
-- (Refresh every few seconds)
SELECT 
    NOW() as query_time,
    'PAYMENTS' as table_name,
    COUNT(*) as recent_count
FROM payments 
WHERE created_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 
    NOW(),
    'BOOKINGS',
    COUNT(*)
FROM bookings 
WHERE created_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 
    NOW(),
    'CREDIT_TRANSACTIONS',
    COUNT(*)
FROM credit_transactions 
WHERE created_at > NOW() - INTERVAL '5 minutes';

-- === 8. SPECIFIC USER MONITORING ===
-- Replace 'user@example.com' with the test user's email
/*
SELECT 
    u.email,
    prof.credits as current_credits,
    COUNT(b.id) as total_bookings,
    COUNT(p.id) as total_payments,
    SUM(CASE WHEN p.status = 'paid' THEN p.amount_paid ELSE 0 END) as total_paid
FROM auth.users u
LEFT JOIN profiles prof ON u.id = prof.id
LEFT JOIN bookings b ON u.id = b.user_id
LEFT JOIN payments p ON u.id = p.user_id
WHERE u.email = 'user@example.com'
GROUP BY u.id, u.email, prof.credits;
*/

-- === 9. TRIGGER STATUS CHECK ===
-- Verify that booking credit triggers are enabled
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_condition
FROM information_schema.triggers 
WHERE trigger_name LIKE '%booking%credit%' 
OR trigger_name LIKE '%credit%booking%';

-- === 10. RECENT ERRORS DETECTION ===
-- Look for potential constraint violations or errors
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('bookings', 'payments', 'credit_transactions')
AND attname IN ('id', 'booking_id', 'user_id');

-- ==========================================
-- USAGE INSTRUCTIONS:
-- ==========================================
-- 1. Open multiple terminal windows/tabs
-- 2. Run Query #7 (Active Monitoring) in one terminal on repeat
-- 3. Use specific queries #1-6 to drill down when you see activity
-- 4. Correlate the timestamps with your [BOOKING_FLOW] console logs
-- 5. For testing, run Query #8 with your test user's email
-- ========================================== 