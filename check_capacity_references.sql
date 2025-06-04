-- COMPREHENSIVE CHECK FOR "CAPACITY" REFERENCES IN DATABASE
-- Run these queries in your Supabase SQL editor

-- 1. Check current column names in accommodations table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'accommodations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check all functions/procedures that mention "capacity"
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) ILIKE '%capacity%'
AND n.nspname IN ('public', 'auth', 'storage')
ORDER BY n.nspname, p.proname;

-- 3. Check all views that mention "capacity"
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE definition ILIKE '%capacity%'
AND schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, viewname;

-- 4. Check all triggers that mention "capacity"
SELECT 
    trigger_schema,
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE action_statement ILIKE '%capacity%'
AND trigger_schema IN ('public', 'auth', 'storage')
ORDER BY trigger_schema, trigger_name;

-- 5. Check all constraints that mention "capacity"
SELECT 
    tc.constraint_schema,
    tc.constraint_name,
    tc.table_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE (cc.check_clause ILIKE '%capacity%' OR tc.constraint_name ILIKE '%capacity%')
AND tc.constraint_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- 6. Check all indexes that mention "capacity"
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef ILIKE '%capacity%'
AND schemaname = 'public'
ORDER BY tablename, indexname;

-- 7. Check for any custom types that mention "capacity"
SELECT 
    n.nspname as schema_name,
    t.typname as type_name,
    pg_catalog.format_type(t.oid, NULL) as type_definition
FROM pg_type t
LEFT JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE t.typname ILIKE '%capacity%'
AND n.nspname = 'public'
ORDER BY n.nspname, t.typname;

-- 8. Search for "capacity" in all stored procedure/function source code
SELECT 
    routine_schema,
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_definition ILIKE '%capacity%'
AND routine_schema = 'public'
ORDER BY routine_name;

-- 9. Check RLS policies that might reference "capacity"
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE (qual ILIKE '%capacity%' OR with_check ILIKE '%capacity%')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 10. Final verification - show the actual accommodations table structure
\d+ accommodations 