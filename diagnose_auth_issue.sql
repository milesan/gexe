-- Diagnostic script to check auth user creation issues

-- 1. Check all triggers on auth.users
SELECT 
    t.tgname AS trigger_name,
    p.proname AS function_name,
    n.nspname AS function_schema,
    CASE t.tgenabled
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS'
    END AS trigger_status,
    CASE t.tgtype::int & 2
        WHEN 2 THEN 'BEFORE'
        ELSE 'AFTER'
    END AS trigger_timing,
    CASE t.tgtype::int & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        WHEN 20 THEN 'INSERT OR UPDATE'
        WHEN 24 THEN 'UPDATE OR DELETE'
        WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
    END AS trigger_event
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace ns ON ns.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE ns.nspname = 'auth' 
  AND c.relname = 'users'
  AND t.tgisinternal = FALSE
ORDER BY t.tgname;

-- 2. Check if handle_new_user function exists
SELECT 
    p.proname AS function_name,
    n.nspname AS schema_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('handle_new_user', 'set_user_metadata')
ORDER BY p.proname;

-- 3. Check profiles table structure
SELECT 
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'profiles'
ORDER BY c.ordinal_position;

-- 4. Check for any constraints on profiles
SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_namespace nsp ON nsp.oid = con.connamespace
JOIN pg_class cls ON cls.oid = con.conrelid
WHERE nsp.nspname = 'public'
  AND cls.relname = 'profiles';

-- 5. Check for duplicate auth users with same email (case sensitivity issue)
WITH email_counts AS (
    SELECT 
        LOWER(email) as normalized_email,
        COUNT(*) as user_count,
        array_agg(email ORDER BY created_at) as email_variations,
        array_agg(id::text ORDER BY created_at) as user_ids
    FROM auth.users
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
)
SELECT * FROM email_counts;

-- 6. Check if whitelist table exists and has entries
SELECT 
    COUNT(*) as whitelist_count,
    COUNT(DISTINCT LOWER(email)) as unique_emails
FROM whitelist;

-- 7. Test what happens when we try to create a non-whitelisted user manually
-- This would be run separately:
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
-- VALUES (gen_random_uuid(), 'test-non-whitelisted@example.com', crypt('test123', gen_salt('bf')), now());