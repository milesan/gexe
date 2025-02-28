-- Add created_account_at column to whitelist table
ALTER TABLE public.whitelist
ADD COLUMN IF NOT EXISTS created_account_at timestamp with time zone;

-- Add has_created_account column if it doesn't exist (for completeness)
ALTER TABLE public.whitelist
ADD COLUMN IF NOT EXISTS has_created_account boolean DEFAULT false;
