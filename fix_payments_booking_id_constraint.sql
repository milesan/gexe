-- Fix the payments table booking_id constraint
-- This allows pending payments to be created without a booking_id

-- First, drop the foreign key constraint if it exists
ALTER TABLE public.payments 
DROP CONSTRAINT IF EXISTS payments_booking_id_fkey;

-- Drop the NOT NULL constraint on booking_id
ALTER TABLE public.payments 
ALTER COLUMN booking_id DROP NOT NULL;

-- Re-add the foreign key constraint but allow NULL values
ALTER TABLE public.payments 
ADD CONSTRAINT payments_booking_id_fkey 
FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

-- Verify the change
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name = 'booking_id'; 