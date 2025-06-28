# Booking Price Breakdown Update

This update adds additional fields to the bookings table to track the complete price breakdown for better transparency and reporting.

## New Fields Added

1. **seasonal_discount_percent** (DECIMAL(5,2))
   - The average seasonal discount percentage applied to the accommodation
   - Calculated as a weighted average based on nights in each season

2. **accommodation_price_after_seasonal_duration** (DECIMAL(10,2))
   - The accommodation price after applying seasonal and duration discounts
   - This is before any discount codes are applied
   - Formula: `base_price - seasonal_adjustment - (base_price * duration_discount_percent / 100)`

3. **subtotal_after_discount_code** (DECIMAL(10,2))
   - The total amount after applying the discount code
   - This is before credits are deducted
   - Equals the final `total_price` if no credits were used

## Complete Price Breakdown Flow

```
Original Accommodation Price (accommodation_price)
├── Apply Seasonal Discount % (seasonal_discount_percent) → Amount: seasonal_adjustment
├── Apply Duration Discount % (duration_discount_percent)
└── = Accommodation After Discounts (accommodation_price_after_seasonal_duration)

Food & Facilities Price (food_contribution)
└── (Already includes duration discount in the selected amount)

Subtotal = Accommodation After Discounts + Food & Facilities

Apply Discount Code (applied_discount_code, discount_code_percent)
└── = Subtotal After Code (subtotal_after_discount_code)

Apply Credits (credits_used)
└── = Final Amount Paid (total_price - credits_used)
```

## Migration Instructions

1. Run the SQL migration to add the new columns:
   ```sql
   psql $DATABASE_URL < add_missing_price_fields.sql
   ```

2. The migration is backwards compatible - all new fields are nullable
3. Old bookings will have NULL values for these fields
4. New bookings will automatically populate these fields

## Code Changes

- **BookingSummary.tsx**: Updated to calculate and pass the new fields
- **BookingService.ts**: Updated to accept and save the new fields
- **PriceBreakdownModal.tsx**: Updated to display seasonal discount percentage when available
- **Type definitions**: Updated in `src/types/index.ts` and `src/types.ts`

## Backwards Compatibility

- All new fields are optional/nullable
- The PriceBreakdownModal handles both old bookings (without detailed breakdown) and new bookings
- No changes required to existing booking queries or displays 