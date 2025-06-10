# Login Flow Summary

## Quick Reference

### Current Login Flow for Each User Type

1. **Whitelisted Users**
   - Email exists in `whitelist` table
   - **Without application record**: Forced to `/whitelist-signup` ❌
   - **With application record**: Can access main app ✅
   - **Welcome modal**: Shows if `has_seen_welcome = false`

2. **New Users (Non-Whitelisted)**
   - Not in `whitelist` table, no account yet
   - Sign up → Redirect to `/retro2` → Fill application → `/pending`

3. **Existing Users (Non-Whitelisted)**
   - **Pending**: Stay on `/pending` page
   - **Approved**: Full access to main app
   - **Rejected**: `/pending` page with rejection message

## Key Problems Identified

### 1. Whitelisted Users Are Broken
- They're supposed to skip the application process
- But they MUST have an application record or they get stuck
- This defeats the entire purpose of whitelisting

### 2. Triple Data Storage
```
has_seen_welcome: stored in whitelist table AND user metadata
application_status: stored in applications table AND user metadata  
approved status: derived from BOTH places
```

### 3. Complex State Machine
- 50+ migration files trying to fix auth
- Multiple edge cases and race conditions
- Inconsistent data between tables and metadata

## SQL Queries to Run

### Find Broken Whitelisted Users
```sql
-- Whitelisted users stuck without application records
SELECT w.email, u.id as user_id
FROM whitelist w
JOIN auth.users u ON u.email = w.email
LEFT JOIN applications a ON a.user_id = u.id
WHERE a.id IS NULL;
```

### Check Data Inconsistencies
```sql
-- Metadata vs table mismatches
SELECT u.email,
  u.raw_user_meta_data->>'application_status' as metadata_status,
  a.status as table_status
FROM auth.users u
JOIN applications a ON a.user_id = u.id
WHERE u.raw_user_meta_data->>'application_status' != a.status;
```

### Simulate User Routing
```sql
-- What route would each user take?
Run the query from LOGIN_FLOW_VERIFICATION_QUERIES.sql section 6
```

## Quick Fixes

### Fix Stuck Whitelisted Users
```sql
-- Create missing application records
INSERT INTO applications (user_id, data, status)
SELECT u.id, '{"auto_created": true}'::jsonb, 'approved'
FROM whitelist w
JOIN auth.users u ON u.email = w.email
LEFT JOIN applications a ON a.user_id = u.id
WHERE a.id IS NULL;
```

### Sync has_seen_welcome
```sql
-- Update user metadata from whitelist table
UPDATE auth.users u
SET raw_user_meta_data = raw_user_meta_data || 
  jsonb_build_object('has_seen_welcome', w.has_seen_welcome)
FROM whitelist w
WHERE u.email = w.email;
```

## Long-term Recommendations

1. **Pick ONE Source of Truth**
   - Either metadata OR tables, not both
   - Recommend: Keep everything in tables, metadata for caching only

2. **Simplify Whitelist Flow**
   - Whitelisted users should NOT need application records
   - They should go straight to main app + welcome modal

3. **Create User Status View**
   ```sql
   CREATE VIEW user_status AS
   SELECT 
     u.id,
     u.email,
     CASE
       WHEN w.email IS NOT NULL THEN 'whitelisted'
       WHEN a.status = 'approved' THEN 'approved'
       WHEN a.status = 'rejected' THEN 'rejected'
       WHEN a.status = 'pending' THEN 'pending'
       ELSE 'new'
     END as status,
     COALESCE(w.has_seen_welcome, u.raw_user_meta_data->>'has_seen_welcome' = 'true', false) as has_seen_welcome
   FROM auth.users u
   LEFT JOIN whitelist w ON w.email = u.email
   LEFT JOIN applications a ON a.user_id = u.id;
   ```

4. **Refactor App.tsx Routing**
   - Use the single view/RPC instead of multiple checks
   - Remove metadata dependencies
   - Simplify the decision tree

5. **Add Audit Trail**
   - Track all status changes
   - Log who approved/rejected applications
   - Track whitelist additions/removals

## The Real Issue

You're trying to maintain two parallel user flows (whitelist vs application) but forcing them through the same funnel. Either:

1. **Keep them separate**: Whitelisted users bypass everything
2. **Merge them**: Everyone goes through the same flow, whitelist just pre-approves

Right now you have the worst of both worlds - complexity without benefits