-- Fix existing credit discrepancy caused by integer precision bug
-- This script corrects the 0.41 credits that should have been deducted but weren't due to rounding

-- Analysis: User redis213+creditstest@gmail.com has 0.41 credits remaining
-- This is due to Extension 3 where 84.41 credits should have been deducted but only 84.00 was deducted
-- The 0.41 difference needs to be corrected

-- Option 1: Deduct the remaining 0.41 credits to make it exactly 0.00
UPDATE profiles 
SET credits = 0.00
WHERE id = '6c405e35-3818-4f62-8b7d-08b3c0f738fd' 
AND credits = 0.41;

-- Record the correction transaction
INSERT INTO credit_transactions (
  user_id, 
  booking_id, 
  amount, 
  new_balance, 
  transaction_type, 
  notes
)
VALUES (
  '6c405e35-3818-4f62-8b7d-08b3c0f738fd',
  'c0a96c03-1ae1-4eed-a063-21f387d39ccd', -- The booking that caused the discrepancy
  -0.41, -- Deduct the remaining 0.41
  0.00,  -- New balance will be exactly 0.00
  'admin_adjustment',
  'Correcting precision discrepancy from Extension 3 - should have deducted 84.41 but only deducted 84.00 due to integer rounding bug'
);

-- Verification query to confirm the fix
SELECT 
  email,
  credits as corrected_balance,
  '0.41 credit discrepancy has been corrected' as status
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.id = '6c405e35-3818-4f62-8b7d-08b3c0f738fd';

-- Optional: Find other users who might be affected by the same bug
-- (Users with small fractional credit balances that might be due to rounding)
SELECT 
  u.email,
  p.credits,
  'Potential rounding discrepancy' as issue
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.credits > 0 
  AND p.credits < 1 
  AND p.credits != ROUND(p.credits, 0) -- Has decimal places
ORDER BY p.credits DESC; 