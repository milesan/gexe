-- Add accommodation_price_paid column to bookings table
-- This stores the actual accommodation amount paid after all discounts
-- Only populated for new bookings to avoid affecting existing data

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS accommodation_price_paid DECIMAL(10, 2);

-- Add a comment to explain the column
COMMENT ON COLUMN bookings.accommodation_price_paid IS 'Actual accommodation amount paid after all discounts (seasonal, duration, etc). Only populated for bookings created after this migration.';

-- Do NOT update existing bookings - as requested by user to be careful with historical data
-- The price breakdown modal will fall back to calculating from percentages for old bookings 