-- Add price breakdown columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accommodation_price numeric(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS food_contribution numeric(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seasonal_adjustment numeric(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_discount_percent numeric(5,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_code_percent numeric(5,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS applied_discount_code text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2);

-- Add helpful indexes for breakdown queries
CREATE INDEX IF NOT EXISTS idx_bookings_applied_discount_code ON bookings (applied_discount_code);
CREATE INDEX IF NOT EXISTS idx_bookings_breakdown_data ON bookings (accommodation_price, food_contribution);

-- Add comments to explain the breakdown fields
COMMENT ON COLUMN bookings.accommodation_price IS 'Base accommodation cost before any discounts (per stay, not per week)';
COMMENT ON COLUMN bookings.food_contribution IS 'Base food & facilities cost before any discounts (per stay, not per week)';
COMMENT ON COLUMN bookings.seasonal_adjustment IS 'Total seasonal discount amount applied to accommodation';
COMMENT ON COLUMN bookings.duration_discount_percent IS 'Duration discount percentage applied to both accommodation and food';
COMMENT ON COLUMN bookings.discount_code_percent IS 'Discount code percentage applied';
COMMENT ON COLUMN bookings.applied_discount_code IS 'The discount code that was applied to this booking';
COMMENT ON COLUMN bookings.discount_amount IS 'Total discount amount applied (seasonal + duration + discount code)'; 