-- Add column to track what the discount code applies to
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS discount_code_applies_to text;

-- Add check constraint for valid values
ALTER TABLE bookings
ADD CONSTRAINT check_discount_code_applies_to 
CHECK (discount_code_applies_to IN ('food_facilities', 'total') OR discount_code_applies_to IS NULL);

-- Update existing bookings based on known discount codes
UPDATE bookings 
SET discount_code_applies_to = 'food_facilities'
WHERE applied_discount_code IN (
  'LEILALALA', 'LEONAISABAMF', 'GRETA44', 'SPLITBOOK', 'ECHONITZSCHE',
  'RIAIR', 'ALASKA444', 'EUGENIOYO', 'FEVERISHMACABRE', 'ECHOOFCODY',
  'HUWRU', 'ALICEINGARDENLAND', 'META4NETA', 'LOVERISES', 'TANAYAYAY'
);

UPDATE bookings 
SET discount_code_applies_to = 'total'
WHERE applied_discount_code IN (
  'LUCIEWK2', 'BOOKITOUT77', 'PHILLIPSMUSINGS', 'GRETATERG', 'ANDREISGAY',
  'GIBSONSMUSINGS05', 'SUMMER21', 'WHYISTHECARDNOTAUTH?', 'UMEBOSHIILOVEYOU',
  'LLELASBOOKING', 'GUSTO', 'MAR-GOT-GOODS'
); 