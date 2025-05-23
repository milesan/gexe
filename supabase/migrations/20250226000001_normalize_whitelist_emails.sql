-- Normalize all existing whitelist emails to lowercase
-- This ensures consistency with Supabase Auth's email normalization

UPDATE whitelist 
SET email = LOWER(email), 
    updated_at = now()
WHERE email != LOWER(email);

-- Log how many emails were updated
DO $$
DECLARE
    updated_count integer;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Normalized % whitelist emails to lowercase', updated_count;
END $$; 