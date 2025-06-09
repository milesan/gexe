-- NUCLEAR OPTION: Reset ALL user credits to 0
-- WARNING: This affects ALL existing users, not just new ones!

-- Step 1: Create backup table (VERY IMPORTANT - run this first!)
CREATE TABLE IF NOT EXISTS profiles_credit_backup AS
SELECT id, email, credits, created_at, 'backup_' || now()::text as backup_timestamp
FROM profiles
WHERE credits > 0;

-- Step 2: Check what we're about to destroy
SELECT 
  COUNT(*) as total_users_with_credits,
  SUM(credits) as total_credits_to_be_destroyed,
  AVG(credits) as average_credits_per_user,
  MAX(credits) as highest_credit_balance
FROM profiles 
WHERE credits > 0;

-- Step 3: The nuclear option - reset everyone to 0 credits
-- is 

-- Step 4: Verify the damage
-- SELECT COUNT(*) as users_with_credits FROM profiles WHERE credits > 0;

-- RECOVERY QUERY (if you need to restore):
/*
UPDATE profiles 
SET credits = b.credits 
FROM profiles_credit_backup b 
WHERE profiles.id = b.id;
*/ 