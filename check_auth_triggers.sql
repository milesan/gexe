-- Check what triggers exist on auth.users
SELECT 
    t.tgname AS trigger_name,
    p.proname AS function_name,
    n.nspname AS function_schema,
    CASE t.tgenabled
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS'
    END AS trigger_status
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace ns ON ns.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE ns.nspname = 'auth' 
  AND c.relname = 'users'
  AND t.tgisinternal = FALSE
ORDER BY t.tgname;

-- Also check the current function definition
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'set_user_metadata'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');