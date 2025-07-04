-- ==========================================
-- CREDIT DISCREPANCY INVESTIGATION
-- ==========================================
-- Debug why credit balance doesn't match expected calculations

-- 1. Current credit status
SELECT 
    u.email,
    p.credits as current_actual_balance,
    p.id as profile_id
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = 'redis213+creditstest@gmail.com';

-- 2. Complete credit transaction history with running balance
SELECT 
    ct.id,
    ct.created_at,
    ct.amount,
    ct.new_balance as recorded_balance,
    ct.transaction_type,
    ct.notes,
    ct.booking_id,
    -- Calculate what the running balance should be
    SUM(ct.amount) OVER (ORDER BY ct.created_at ROWS UNBOUNDED PRECEDING) as calculated_running_balance
FROM credit_transactions ct
JOIN auth.users u ON ct.user_id = u.id
WHERE u.email = 'redis213+creditstest@gmail.com'
ORDER BY ct.created_at ASC;

-- 3. Check for any missing or duplicate transactions
SELECT 
    booking_id,
    COUNT(*) as transaction_count,
    SUM(amount) as total_credit_change,
    STRING_AGG(notes, ' | ') as all_notes
FROM credit_transactions ct
JOIN auth.users u ON ct.user_id = u.id
WHERE u.email = 'redis213+creditstest@gmail.com'
AND booking_id IS NOT NULL
GROUP BY booking_id
ORDER BY MAX(ct.created_at) DESC;

-- 4. Verify recent extension credit deductions
SELECT 
    b.id as booking_id,
    b.credits_used,
    b.updated_at as booking_updated,
    -- Extension transactions
    ct.amount as credit_transaction_amount,
    ct.new_balance as balance_after_transaction,
    ct.created_at as transaction_time,
    -- Check if credits_used matches transaction amount
    CASE 
        WHEN ABS(b.credits_used + ct.amount) < 0.01 THEN 'MATCH'
        ELSE 'MISMATCH'
    END as amount_verification
FROM bookings b
LEFT JOIN credit_transactions ct ON b.id = ct.booking_id AND ct.amount < 0
WHERE b.id IN (
    'dc9e1030-5df5-49be-88b9-a0d0200c82c7',  -- Extension 2 booking
    'c0a96c03-1ae1-4eed-a063-21f387d39ccd'   -- Extension 3 booking
)
ORDER BY b.updated_at DESC;

-- 5. Check for any rounding discrepancies
SELECT 
    'CREDIT_PRECISION_CHECK' as check_type,
    p.credits as current_balance_decimal,
    ROUND(p.credits, 2) as current_balance_rounded,
    -- Sum all transactions to verify total
    (
        SELECT SUM(ct.amount) 
        FROM credit_transactions ct 
        WHERE ct.user_id = p.id
    ) as total_transaction_sum,
    -- Check if there are precision issues
    ABS(p.credits - ROUND(p.credits, 2)) as precision_difference
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'redis213+creditstest@gmail.com';

-- 6. Timeline of recent credit activity (last hour)
SELECT 
    'RECENT_ACTIVITY' as event_type,
    ct.created_at,
    ct.amount,
    ct.new_balance,
    ct.notes,
    -- Time since previous transaction
    LAG(ct.created_at) OVER (ORDER BY ct.created_at) as previous_transaction,
    ct.created_at - LAG(ct.created_at) OVER (ORDER BY ct.created_at) as time_gap
FROM credit_transactions ct
JOIN auth.users u ON ct.user_id = u.id
WHERE u.email = 'redis213+creditstest@gmail.com'
AND ct.created_at > NOW() - INTERVAL '1 hour'
ORDER BY ct.created_at DESC;

-- ==========================================
-- QUESTIONS TO ANSWER:
-- ==========================================
-- 1. What's the actual current balance? (Should be 0.41 as user reports)
-- 2. Do the credit transactions match the booking.credits_used amounts?
-- 3. Are there any missing credit deductions for recent extensions?
-- 4. Is this a rounding/precision issue?
-- 5. Did the triggers fire correctly for recent extensions?
-- ========================================== 