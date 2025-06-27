# Price Breakdown Fix Instructions

## Problem
The `PriceBreakdownModal.tsx` was trying to display detailed price breakdowns, but historical bookings lacked the necessary breakdown data fields in the database. A previous reverse engineering script had incorrect calculations, storing wrong accommodation and food costs.

## Solution
1. **Added missing database columns** with proper migration
2. **Created corrected reverse engineering script** with proper math
3. **Fixed the core bug**: Food cost = Total Paid - Accommodation Paid (simple subtraction!)

## Steps to Fix

### 1. Apply Database Migration
```sql
-- Run the migration to add missing columns
-- This is in: supabase/migrations/20250128000001_add_price_breakdown_columns.sql
```

### 2. Run the Fixed Reverse Engineering Script
```bash
cd scripts
npm install
npm run reverse-engineer-fixed
```

## What the Fixed Script Does

1. **Fetches real accommodation prices** from the accommodations table
2. **Calculates base costs correctly**:
   - Accommodation: `base_price * exact_weeks`
   - Food: `total_paid - accommodation_paid_after_discounts`
3. **Applies discounts in correct order**:
   - Seasonal (accommodation only, multiplicative)
   - Duration (both accommodation + food, multiplicative)  
   - Discount codes (scope-aware: 'total' vs 'food_facilities')
4. **Verifies calculations** against actual payments
5. **Clears any previous bad data** before updating

## Example: Valleyview Room Fix

**Before (broken script)**:
- Accommodation: €991.71 
- Food: €370.62
- **Total: €1,362.33** ❌ (Missing €317.67!)

**After (fixed script)**:
- Accommodation: €534/week × 2 weeks = €1,068
- Food: €1,680 - €1,068 = €612  
- **Total: €1,680** ✅ (Matches payment!)

## Key Fixes Applied

1. **Database schema**: Added missing breakdown columns
2. **Accommodation pricing**: Uses real prices from accommodations table
3. **Food calculation**: Simple subtraction instead of bogus formulas
4. **Discount order**: Proper multiplicative application
5. **Verification**: Ensures breakdown sums to actual payment

## Files Modified
- `supabase/migrations/20250128000001_add_price_breakdown_columns.sql` (new)
- `scripts/fixed-reverse-engineer.js` (new)
- `scripts/package.json` (updated)
- Deleted broken scripts: `enhanced-reverse-engineer-v2.js`, `enhanced-reverse-engineer.js`

The `PriceBreakdownModal.tsx` should now work correctly with properly calculated breakdown data! 