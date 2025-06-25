# Booking Breakdown Reverse Engineering Scripts

These scripts reverse-engineer missing pricing breakdown data for historical bookings in the GEXE system.

## What This Does

The `PriceBreakdownModal` requires detailed breakdown data that wasn't stored in older bookings. This script calculates the missing fields:

- `accommodation_price` - Total accommodation cost
- `food_contribution` - Weekly food contribution rate 
- `seasonal_adjustment` - Euro amount of seasonal discount
- `duration_discount_percent` - Percentage discount for 3+ week stays
- `discount_code_percent` - Percentage discount from discount codes

## Setup

1. **Install dependencies:**
   ```bash
   cd scripts
   npm install
   ```

2. **Set environment variables:**
   
   **Option A - Use existing .env from parent:**
   ```bash
   # Copy from your main project root
   cp ../.env .env
   ```
   
   **Option B - Set manually:**
   ```bash
   export VITE_SUPABASE_URL="your-supabase-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

## Usage

### Test on Single Booking (Recommended First)

Test the logic on one booking to verify calculations:

```bash
# Using a booking ID from your sample data
npm run test-breakdown ada89b1d-38cf-4c1c-9fcd-d3bc96e93fb9
```

This will show:
- Current booking data
- Calculated breakdown
- Proposed database updates
- Verification of totals

### Run on All Bookings

⚠️ **This modifies your database!** Test first.

```bash
npm run reverse-engineer
```

## Calculation Logic

### Accommodation Pricing
1. **Base Price:** From `accommodations.base_price` 
2. **Seasonal Discount:** 40% (Low), 15% (Medium), 0% (Summer) - dorms excluded
3. **Duration Discount:** 10% + 2.78% per week beyond 3 weeks (capped at 35%)
4. **Final:** `base_price * (1 - seasonal) * (1 - duration) * exact_weeks`

### Food Pricing  
1. **Estimated Contribution:** €368/week (≤6 nights) or €315/week (>6 nights)
2. **Duration Discount:** Same as accommodation (3+ weeks only)
3. **Final:** `contribution * (1 - duration) * exact_weeks`

### Discount Codes
- **Reverse-engineered** from `total_discount_amount - (seasonal + duration amounts)`
- **Applied proportionally** to accommodation + food subtotal

## Assumptions Made

📝 **Food Contributions:** Estimated using middle-of-range defaults  
📝 **Seasonal Discounts:** Calculated using current season logic  
📝 **Duration Discounts:** Calculated using current duration logic  
📝 **Discount Codes:** Reverse-engineered from total discount amount  
📝 **Base Prices:** Assumes current accommodation prices were used historically  

## Verification

The script verifies calculations by:
1. Computing expected total: `accommodation + food - discounts - credits`
2. Comparing against actual `total_price` in database
3. Flagging discrepancies > €5 as "HIGH" warnings

## Output Example

```
=== Processing Booking ada89b1d-38cf-4c1c-9fcd-d3bc96e93fb9 ===
Accommodation: Van Parking (0)
Stay: 6 nights (0.86 weeks)
Total Price: €368
Existing Discount: €0

Calculated Discounts: Seasonal 0.0%, Duration 0.0%
Food Contribution: estimated €368/week

Calculated Breakdown:
- Accommodation: €0.00 (€0/week)
- Food: €315.43 (€368/week)  
- Seasonal Adjustment: €0.00
- Discount Code: 0.0%

Verification: Calculated €315.43 vs Actual €368
Discrepancy: €52.57 ⚠️  HIGH
```

## Troubleshooting

**High Discrepancies:** Usually caused by:
- Custom pricing that doesn't match current logic
- Manual adjustments not accounted for
- Changed base prices since booking

**Missing Bookings:** Check that breakdown fields exist in your database schema.

**Environment Issues:** Ensure you have the service role key, not the anon key. 