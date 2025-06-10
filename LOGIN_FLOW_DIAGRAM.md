# Login Flow Diagram

## Visual Flow Chart

```
┌─────────────────┐
│   User Login    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌────────────────────────┐
│ get_user_app_   │────▶│ Check:                 │
│ entry_status_v2 │     │ - is_whitelisted       │
└─────────────────┘     │ - needs_welcome        │
                        │ - has_application_rec  │
                        └───────────┬────────────┘
                                    │
                ┌───────────────────┴────────────────────┐
                │                                        │
                ▼                                        ▼
        ┌───────────────┐                       ┌────────────────┐
        │  WHITELISTED  │                       │ NON-WHITELISTED│
        └───────┬───────┘                       └───────┬────────┘
                │                                        │
     ┌──────────┴──────────┐                  ┌─────────┴──────────┐
     │                     │                  │                    │
     ▼                     ▼                  ▼                    ▼
┌─────────┐         ┌──────────────┐   ┌────────────┐      ┌─────────────┐
│ No App  │         │   Has App    │   │  No App    │      │   Has App   │
│ Record  │         │   Record     │   │  Record    │      │   Record    │
└────┬────┘         └──────┬───────┘   └─────┬──────┘      └──────┬──────┘
     │                     │                  │                     │
     ▼                     ▼                  ▼                     ▼
┌─────────────┐     ┌──────────────┐   ┌──────────┐        ┌──────────────┐
│ FORCE TO    │     │needs_welcome?│   │ REDIRECT │        │Check Status: │
│ /whitelist- │     └──────┬───────┘   │   TO     │        │- pending     │
│   signup    │            │           │ /retro2  │        │- approved    │
└─────┬───────┘            │           │(app form)│        │- rejected    │
      │               ┌────┴────┐      └──────────┘        └──────┬───────┘
      │               │         │                                  │
      ▼               ▼         ▼                            ┌─────┴─────┐
┌──────────┐    ┌─────────┐ ┌──────┐                       │           │
│ Collect: │    │ Show    │ │ Main │                       ▼           ▼
│ - Name   │    │ Welcome │ │ App  │                 ┌─────────┐ ┌─────────┐
│ - Contact│    │ Modal   │ └──────┘                 │/pending │ │ Main    │
│ - Avatar │    └────┬────┘                          │  page   │ │  App    │
└────┬─────┘         │                               └─────────┘ └─────────┘
     │               ▼
     │         ┌──────────┐
     │         │ Main App │
     │         └──────────┘
     │
     └──────────────┐
                    ▼
            ┌───────────────┐
            │Create App Rec │
            │status=approved│
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │ Navigate to / │
            │ with flag to  │
            │ show welcome  │
            └───────────────┘
```

## Key Decision Points

### 1. Initial RPC Call
```typescript
get_user_app_entry_status_v2(userId, email) returns {
  is_whitelisted: boolean,      // Email in whitelist table?
  needs_welcome: boolean,        // is_whitelisted AND NOT has_seen_welcome
  has_application_record: boolean // Record in applications table?
}
```

### 2. Routing Logic Priority
1. **Admin Check** (uses metadata) → Full access
2. **Approved Check** (uses metadata) → Full access
3. **Whitelisted WITHOUT Application** → Force to `/whitelist-signup`
4. **Whitelisted WITH Application** → Show welcome modal if needed
5. **Non-whitelisted, No Application** → Send to `/retro2` form
6. **Non-whitelisted, Has Application** → Check status → `/pending` or main app

## Data Storage Locations

```
┌─────────────────────────────────────────────────────────┐
│                   USER DATA STORAGE                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌─────────────┐    ┌────────────┐ │
│  │  WHITELIST   │    │APPLICATIONS │    │USER METADATA│ │
│  │    TABLE     │    │   TABLE     │    │(auth.users) │ │
│  ├──────────────┤    ├─────────────┤    ├────────────┤ │
│  │ email        │    │ user_id     │    │has_applied │ │
│  │ has_created_ │    │ data (jsonb)│    │approved    │ │
│  │   account    │    │ status      │    │application_│ │
│  │ has_seen_    │    │ created_at  │    │  status    │ │
│  │   welcome    │    │ updated_at  │    │has_seen_   │ │
│  │ has_booked   │    └─────────────┘    │  welcome   │ │
│  │ etc...       │                        │is_white-   │ │
│  └──────────────┘                        │  listed    │ │
│                                          └────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## The Problems

1. **Triple Storage**: Same data in 3 places
2. **Forced Application**: Whitelisted users must create application records
3. **Inconsistent Checks**: Some use metadata, some use tables, some use RPC
4. **Complex State Machine**: Too many edge cases and transitions
5. **Migration Hell**: 50+ migration files trying to fix this

## Simplified Alternative

```
User Login
    │
    ▼
┌─────────────┐
│Single Check:│
│User Status  │
└──────┬──────┘
       │
   ┌───┴───┐
   │Status?│
   └───┬───┘
       │
   ┌───┼────────┬──────────┐
   │   │        │          │
   ▼   ▼        ▼          ▼
[new] [pending] [approved] [admin]
   │      │        │         │
   ▼      ▼        ▼         ▼
/apply  /wait   /main     /main
                           +admin
```

Much simpler, right?