-- ==========================================
-- EXTENSION FLOW DATABASE MONITORING QUERIES
-- ==========================================
-- Use these queries to trace what's happening during the booking extension process
-- Filter console logs with [EXTENSION_FLOW] to correlate with database changes

-- === 1. MONITOR BOOKING EXTENSIONS (Step 4) ===
-- Watch for bookings being extended (check_out date changes)
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
    updated_at,
    created_at,
    CASE 
        WHEN updated_at > created_at + INTERVAL '1 minute' THEN 'EXTENDED'
        ELSE 'NEW'
    END as booking_status
FROM bookings 
WHERE updated_at > NOW() - INTERVAL '10 minutes'
OR created_at > NOW() - INTERVAL '10 minutes'
ORDER BY updated_at DESC
LIMIT 5;

-- === 2. MONITOR EXTENSION PAYMENTS ===
-- Watch for extension payments being created
SELECT 
    id,
    booking_id,
    user_id,
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
WHERE payment_type = 'extension'
AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 5;

-- === 3. MONITOR CREDIT TRANSACTIONS FOR EXTENSIONS ===
-- Watch for credit deductions during extensions
SELECT 
    ct.id,
    ct.user_id,
    ct.booking_id,
    ct.amount,
    ct.new_balance,
    ct.transaction_type,
    ct.notes,
    ct.created_at,
    p.credits as current_profile_credits,
    b.check_out as booking_checkout_date
FROM credit_transactions ct
JOIN profiles p ON ct.user_id = p.id
LEFT JOIN bookings b ON ct.booking_id = b.id
WHERE ct.created_at > NOW() - INTERVAL '10 minutes'
AND (ct.notes ILIKE '%extension%' OR ct.transaction_type = 'booking_payment')
ORDER BY ct.created_at DESC
LIMIT 5;

-- === 4. COMPREHENSIVE EXTENSION VIEW ===
-- Get the complete picture for recent extensions
SELECT 
    b.id as booking_id,
    b.check_in,
    b.check_out,
    b.total_price as booking_total,
    b.credits_used as booking_credits,
    b.status as booking_status,
    b.payment_intent_id,
    b.created_at as booking_created,
    b.updated_at as booking_updated,
    CASE 
        WHEN b.updated_at > b.created_at + INTERVAL '1 minute' THEN 'LIKELY_EXTENDED'
        ELSE 'NEW_BOOKING'
    END as extension_indicator,
    
    -- Extension payment details
    ext_p.id as extension_payment_id,
    ext_p.amount_paid as extension_payment_amount,
    ext_p.status as extension_payment_status,
    ext_p.stripe_payment_id as extension_stripe_id,
    ext_p.created_at as extension_payment_created,
    
    -- User details
    u.email as user_email,
    prof.credits as current_user_credits,
    
    -- Accommodation details
    acc.title as accommodation_name
FROM bookings b
LEFT JOIN payments ext_p ON b.id = ext_p.booking_id AND ext_p.payment_type = 'extension'
LEFT JOIN auth.users u ON b.user_id = u.id
LEFT JOIN profiles prof ON b.user_id = prof.id
LEFT JOIN accommodations acc ON b.accommodation_id = acc.id
WHERE b.updated_at > NOW() - INTERVAL '1 hour'
OR ext_p.created_at > NOW() - INTERVAL '1 hour'
ORDER BY COALESCE(b.updated_at, b.created_at) DESC
LIMIT 10;

-- === 5. DETECT EXTENSION ISSUES ===
-- Find potential problems with extensions
SELECT 
    'ORPHANED_EXTENSION_PAYMENT' as issue_type,
    p.id as payment_id,
    p.stripe_payment_id,
    p.amount_paid,
    p.status as payment_status,
    p.created_at as payment_created,
    p.booking_id,
    b.id as actual_booking_id
FROM payments p
LEFT JOIN bookings b ON p.booking_id = b.id
WHERE p.payment_type = 'extension'
AND p.created_at > NOW() - INTERVAL '1 hour'
AND (p.booking_id IS NULL OR b.id IS NULL)

UNION ALL

SELECT 
    'BOOKING_EXTENDED_WITHOUT_PAYMENT' as issue_type,
    NULL as payment_id,
    NULL as stripe_payment_id,
    NULL as amount_paid,
    NULL as payment_status,
    NULL as payment_created,
    b.id as booking_id,
    b.id as actual_booking_id
FROM bookings b
WHERE b.updated_at > b.created_at + INTERVAL '1 minute'
AND b.updated_at > NOW() - INTERVAL '1 hour'
AND NOT EXISTS (
    SELECT 1 FROM payments p 
    WHERE p.booking_id = b.id 
    AND p.payment_type = 'extension'
    AND p.created_at > b.created_at
)
ORDER BY payment_created DESC;

-- === 6. EXTENSION ACTIVITY MONITORING ===
-- Run this continuously during testing to see real-time changes
SELECT 
    NOW() as query_time,
    'EXTENSION_PAYMENTS' as table_name,
    COUNT(*) as recent_count
FROM payments 
WHERE payment_type = 'extension'
AND created_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 
    NOW(),
    'BOOKING_UPDATES',
    COUNT(*)
FROM bookings 
WHERE updated_at > NOW() - INTERVAL '5 minutes'
AND updated_at > created_at + INTERVAL '1 minute'
UNION ALL
SELECT 
    NOW(),
    'EXTENSION_CREDIT_TRANSACTIONS',
    COUNT(*)
FROM credit_transactions 
WHERE created_at > NOW() - INTERVAL '5 minutes'
AND (notes ILIKE '%extension%' OR transaction_type = 'booking_payment');

-- === 7. USER EXTENSION HISTORY ===
-- Track a specific user's extension activity
-- Replace 'user@example.com' with the test user's email
/*
SELECT 
    b.id as booking_id,
    b.check_in,
    b.check_out,
    b.total_price,
    b.created_at as booking_created,
    b.updated_at as booking_updated,
    CASE 
        WHEN b.updated_at > b.created_at + INTERVAL '1 minute' THEN 'EXTENDED'
        ELSE 'ORIGINAL'
    END as booking_type,
    
    -- Extension payments
    COUNT(p.id) as extension_payment_count,
    SUM(CASE WHEN p.payment_type = 'extension' THEN p.amount_paid ELSE 0 END) as total_extension_paid,
    
    -- Credits used in extensions
    SUM(CASE WHEN ct.notes ILIKE '%extension%' THEN ABS(ct.amount) ELSE 0 END) as total_extension_credits_used
FROM auth.users u
JOIN bookings b ON u.id = b.user_id
LEFT JOIN payments p ON b.id = p.booking_id AND p.payment_type = 'extension'
LEFT JOIN credit_transactions ct ON b.id = ct.booking_id AND ct.notes ILIKE '%extension%'
WHERE u.email = 'user@example.com'
AND (b.updated_at > NOW() - INTERVAL '24 hours' OR b.created_at > NOW() - INTERVAL '24 hours')
GROUP BY b.id, b.check_in, b.check_out, b.total_price, b.created_at, b.updated_at
ORDER BY b.updated_at DESC;
*/

-- === 8. EXTENSION PRICING VERIFICATION ===
-- Verify extension pricing calculations make sense
SELECT 
    b.id as booking_id,
    b.check_in,
    b.check_out,
    b.total_price as final_booking_total,
    b.credits_used as total_credits_used,
    
    -- Original payment (initial booking)
    initial_p.amount_paid as initial_payment,
    initial_p.created_at as initial_payment_date,
    
    -- Extension payments
    ext_p.amount_paid as extension_payment,
    ext_p.created_at as extension_payment_date,
    
    -- Calculated totals
    COALESCE(initial_p.amount_paid, 0) + COALESCE(ext_p.amount_paid, 0) as total_payments,
    b.total_price - (COALESCE(initial_p.amount_paid, 0) + COALESCE(ext_p.amount_paid, 0)) as payment_difference,
    
    -- Check if math adds up
    CASE 
        WHEN ABS(b.total_price - (COALESCE(initial_p.amount_paid, 0) + COALESCE(ext_p.amount_paid, 0) + COALESCE(b.credits_used, 0))) < 0.01 
        THEN 'CORRECT' 
        ELSE 'MISMATCH' 
    END as pricing_check
FROM bookings b
LEFT JOIN payments initial_p ON b.id = initial_p.booking_id AND initial_p.payment_type = 'initial'
LEFT JOIN payments ext_p ON b.id = ext_p.booking_id AND ext_p.payment_type = 'extension'
WHERE b.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY b.updated_at DESC
LIMIT 10;

-- === 9. EXTENSION TRIGGER STATUS CHECK ===
-- Verify that extension-related triggers are working
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_condition
FROM information_schema.triggers 
WHERE trigger_name LIKE '%booking%credit%' 
OR trigger_name LIKE '%credit%'
OR event_object_table IN ('bookings', 'payments');

-- === 10. RECENT EXTENSION ERRORS DETECTION ===
-- Look for potential issues with recent extensions
SELECT 
    'NEGATIVE_EXTENSION_PAYMENT' as error_type,
    p.id as record_id,
    p.amount_paid as problematic_value,
    p.created_at
FROM payments p
WHERE p.payment_type = 'extension'
AND p.amount_paid < 0
AND p.created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
    'BOOKING_CHECKOUT_IN_PAST' as error_type,
    b.id as record_id,
    NULL as problematic_value,
    b.updated_at as created_at
FROM bookings b
WHERE b.check_out < NOW()
AND b.updated_at > NOW() - INTERVAL '1 hour'
AND b.updated_at > b.created_at + INTERVAL '1 minute'

UNION ALL

SELECT 
    'EXTENSION_WITHOUT_CREDIT_TRANSACTION' as error_type,
    b.id as record_id,
    b.credits_used as problematic_value,
    b.updated_at as created_at
FROM bookings b
WHERE b.credits_used > 0
AND b.updated_at > b.created_at + INTERVAL '1 minute'
AND b.updated_at > NOW() - INTERVAL '1 hour'
AND NOT EXISTS (
    SELECT 1 FROM credit_transactions ct 
    WHERE ct.booking_id = b.id 
    AND ct.created_at >= b.updated_at - INTERVAL '1 minute'
    AND ct.amount < 0
)
ORDER BY created_at DESC;

-- ==========================================
-- USAGE INSTRUCTIONS:
-- ==========================================
-- 1. Run Query #6 (Extension Activity Monitoring) continuously during testing
-- 2. Use Query #4 (Comprehensive Extension View) to see the complete picture
-- 3. Use Query #5 (Detect Extension Issues) to find problems
-- 4. Use Query #8 (Extension Pricing Verification) to validate calculations
-- 5. For testing, run Query #7 with your test user's email
-- 6. Correlate timestamps with your [EXTENSION_FLOW] console logs
-- ========================================== 