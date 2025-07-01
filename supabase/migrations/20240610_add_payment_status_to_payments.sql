DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
  END IF;
END$$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status payment_status NOT NULL DEFAULT 'pending'; 