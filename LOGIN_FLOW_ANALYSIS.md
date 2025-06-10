# Login Flow Analysis

## Overview

The authentication system uses a combination of:
1. **Whitelist table** - Special users who bypass the application process
2. **Applications table** - Normal user applications
3. **User metadata** - Various flags stored in `raw_user_meta_data`
4. **RPC Function** - `get_user_app_entry_status_v2` as the source of truth

## Key Data Sources

### 1. Whitelist Table
```sql
CREATE TABLE whitelist (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  has_created_account boolean DEFAULT false,
  has_seen_welcome boolean DEFAULT false,
  account_created_at timestamp,
  has_booked boolean DEFAULT false,
  -- ... other tracking fields
);
```

### 2. Applications Table
```sql
CREATE TABLE applications (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  data jsonb NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at timestamp,
  updated_at timestamp
);
```

### 3. User Metadata (in auth.users.raw_user_meta_data)
- `has_applied`: boolean
- `approved`: boolean
- `application_status`: string ('pending', 'approved', 'rejected')
- `is_whitelisted`: boolean (appears to be deprecated)
- `has_seen_welcome`: boolean

### 4. The Source of Truth: get_user_app_entry_status_v2
```sql
-- Returns:
{
  "is_whitelisted": boolean,        -- Email exists in whitelist table
  "needs_welcome": boolean,         -- is_whitelisted AND NOT has_seen_welcome
  "has_application_record": boolean -- Record exists in applications table
}
```

## Login Flow Decision Tree

Based on `App.tsx` routing logic:

### 1. WHITELISTED USERS

#### Scenario 1A: Whitelisted, No Account Yet
- **Database State**: 
  - Email in `whitelist` table
  - No record in `auth.users`
- **Flow**: 
  1. User signs up/logs in
  2. `check_whitelist_status` function runs
  3. User metadata set: `application_status: 'approved'`, `has_applied: true`
  4. User directed to main app

#### Scenario 1B: Whitelisted, Has Account, No Application Record
- **Database State**:
  - Email in `whitelist` table
  - Record in `auth.users`
  - NO record in `applications` table
- **RPC Returns**: `{is_whitelisted: true, needs_welcome: true/false, has_application_record: false}`
- **Flow**: 
  1. **FORCED to `/whitelist-signup`** page
  2. Must complete WhitelistSignupPage form
  3. Application record created
  4. Then shown welcome modal if `needs_welcome: true`

#### Scenario 1C: Whitelisted, Has Account, Has Application, Needs Welcome
- **Database State**:
  - Email in `whitelist` table
  - Record in `auth.users`
  - Record in `applications` table
  - `has_seen_welcome: false` in user metadata
- **RPC Returns**: `{is_whitelisted: true, needs_welcome: true, has_application_record: true}`
- **Flow**:
  1. Directed to main app
  2. Welcome modal shown automatically
  3. On modal close: `has_seen_welcome: true` set in metadata

### 2. NEW USERS (Non-Whitelisted)

#### Scenario 2A: Brand New User
- **Database State**:
  - NOT in `whitelist` table
  - NOT in `auth.users`
- **Flow**:
  1. User signs up
  2. Redirected to `/retro2` (application form)
  3. Fill out application
  4. Application saved to `applications` table with `status: 'pending'`
  5. Redirected to `/pending` page

#### Scenario 2B: Logged In, No Application Yet
- **Database State**:
  - NOT in `whitelist` table
  - Record in `auth.users`
  - NO record in `applications` table
- **RPC Returns**: `{is_whitelisted: false, needs_welcome: false, has_application_record: false}`
- **Flow**:
  1. Redirected to `/retro2` (application form)
  2. Must complete application

### 3. EXISTING USERS (Non-Whitelisted)

#### Scenario 3A: Pending Application
- **Database State**:
  - NOT in `whitelist` table
  - Record in `auth.users`
  - Record in `applications` table with `status: 'pending'`
- **Flow**:
  1. Redirected to `/pending` page
  2. Shows "application under review" message

#### Scenario 3B: Rejected Application
- **Database State**:
  - NOT in `whitelist` table
  - Record in `auth.users`
  - Record in `applications` table with `status: 'rejected'`
- **Flow**:
  1. Redirected to `/pending` page with `status: 'rejected'`
  2. Shows rejection message

#### Scenario 3C: Approved Application
- **Database State**:
  - NOT in `whitelist` table
  - Record in `auth.users`
  - Record in `applications` table with `status: 'approved'`
  - User metadata: `approved: true` or `application_status: 'approved'`
- **Flow**:
  1. Full access to main app
  2. Same as admin users

## Critical Issues & Edge Cases

### 1. Data Duplication
- `has_seen_welcome` stored in BOTH `whitelist` table AND user metadata
- Application status in BOTH `applications` table AND user metadata
- Potential for inconsistency

### 2. Whitelisted Users MUST Have Application Records
- Even though they're "pre-approved", they still need an application record
- Without it, they're stuck in `/whitelist-signup` limbo
- This seems counterintuitive to the purpose of whitelisting

### 3. Metadata vs. Table Data
- The app relies on BOTH metadata and table data
- `get_user_app_entry_status_v2` tries to unify this, but complexity remains
- Some checks still use metadata directly (admin check, approved check)

### 4. Welcome Modal Logic
The welcome modal shows when ALL of these are true:
- `is_whitelisted: true`
- `has_application_record: true`
- `needs_welcome: true` (i.e., `has_seen_welcome: false`)

### 5. Edge Case: Whitelisted + Regular Application
If someone is whitelisted but also submitted a regular application:
- They have records in BOTH systems
- Potential for conflicting status
- Unclear which takes precedence

## Recommendations

1. **Single Source of Truth**: Pick either metadata OR tables, not both
2. **Simplify Whitelist Flow**: Whitelisted users shouldn't need application records
3. **Consistent Status Tracking**: Application status should live in ONE place
4. **Better Edge Case Handling**: Clear rules for users in multiple categories
5. **Audit Trail**: Track all status changes with timestamps and reasons