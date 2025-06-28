-- Add missing pricing fields to bookings table for complete price breakdown tracking
-- This migration maintains backwards compatibility - all new fields are nullable

-- Add seasonal discount percentage (we already have the amount)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS seasonal_discount_percent DECIMAL(5,2);

-- Add accommodation price after seasonal and duration discounts (but before discount codes)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS accommodation_price_after_seasonal_duration DECIMAL(10,2);

-- Add subtotal after discount code is applied (but before credits)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS subtotal_after_discount_code DECIMAL(10,2);

-- Update discount code applies_to constraint to include 'accommodation'
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS check_discount_code_applies_to;

ALTER TABLE bookings
ADD CONSTRAINT check_discount_code_applies_to 
CHECK (discount_code_applies_to IN ('food_facilities', 'total', 'accommodation') OR discount_code_applies_to IS NULL);

-- Add comment to document the pricing flow
COMMENT ON COLUMN bookings.accommodation_price IS 'Original accommodation price before any adjustments';
COMMENT ON COLUMN bookings.seasonal_discount_percent IS 'Average seasonal discount percentage applied';
COMMENT ON COLUMN bookings.seasonal_adjustment IS 'Seasonal discount amount in euros';
COMMENT ON COLUMN bookings.duration_discount_percent IS 'Duration-based discount percentage';
COMMENT ON COLUMN bookings.accommodation_price_after_seasonal_duration IS 'Accommodation price after seasonal and duration discounts but before discount codes';
COMMENT ON COLUMN bookings.food_contribution IS 'Food and facilities contribution amount';
COMMENT ON COLUMN bookings.applied_discount_code IS 'Discount code used (if any)';
COMMENT ON COLUMN bookings.discount_code_percent IS 'Discount code percentage';
COMMENT ON COLUMN bookings.discount_code_applies_to IS 'What the discount applies to: food_facilities, total, or accommodation';
COMMENT ON COLUMN bookings.subtotal_after_discount_code IS 'Total amount after all discounts but before credits';
COMMENT ON COLUMN bookings.credits_used IS 'Garden credits applied to reduce payment';
COMMENT ON COLUMN bookings.total_price IS 'Final amount charged after all discounts and credits';
COMMENT ON COLUMN bookings.accommodation_price_paid IS 'Actual accommodation amount paid after all discounts';

-- Update RLS policies if needed (none required for these fields) 