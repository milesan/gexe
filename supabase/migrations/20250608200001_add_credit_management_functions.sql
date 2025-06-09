-- RPC functions for admin credit management with decimal support

-- Function to add credits
CREATE OR REPLACE FUNCTION admin_add_credits(
    p_user_id UUID,
    p_amount DECIMAL(10,2),
    p_admin_note TEXT DEFAULT NULL
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
    v_admin_id UUID;
BEGIN
    -- Get current admin user
    v_admin_id := auth.uid();
    
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = v_admin_id 
        AND raw_user_meta_data->>'is_admin' = 'true'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;
    
    -- Get current balance
    SELECT credits INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance + p_amount;
    
    -- Update balance
    UPDATE profiles
    SET credits = v_new_balance
    WHERE id = p_user_id;
    
    -- Log transaction if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'credit_transactions') THEN
        INSERT INTO credit_transactions (
            user_id,
            amount,
            new_balance,
            transaction_type,
            notes,
            admin_id,
            created_at
        ) VALUES (
            p_user_id,
            p_amount,
            v_new_balance,
            'admin_add',
            p_admin_note,
            v_admin_id,
            NOW()
        );
    END IF;
    
    RETURN v_new_balance;
END;
$$;

-- Function to remove credits
CREATE OR REPLACE FUNCTION admin_remove_credits(
    p_user_id UUID,
    p_amount DECIMAL(10,2),
    p_admin_note TEXT DEFAULT NULL
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
    v_admin_id UUID;
BEGIN
    -- Get current admin user
    v_admin_id := auth.uid();
    
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = v_admin_id 
        AND raw_user_meta_data->>'is_admin' = 'true'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;
    
    -- Get current balance
    SELECT credits INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Calculate new balance (ensure it doesn't go negative)
    v_new_balance := GREATEST(0, v_current_balance - p_amount);
    
    -- Update balance
    UPDATE profiles
    SET credits = v_new_balance
    WHERE id = p_user_id;
    
    -- Log transaction if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'credit_transactions') THEN
        INSERT INTO credit_transactions (
            user_id,
            amount,
            new_balance,
            transaction_type,
            notes,
            admin_id,
            created_at
        ) VALUES (
            p_user_id,
            -p_amount, -- Negative amount for removal
            v_new_balance,
            'admin_remove',
            p_admin_note,
            v_admin_id,
            NOW()
        );
    END IF;
    
    RETURN v_new_balance;
END;
$$;

-- Create credit_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    new_balance DECIMAL(10,2) NOT NULL,
    transaction_type TEXT NOT NULL,
    notes TEXT,
    admin_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_add_credits TO authenticated;
GRANT EXECUTE ON FUNCTION admin_remove_credits TO authenticated;

-- RLS policies for credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can view all transactions
CREATE POLICY "Admins can view all credit transactions"
    ON credit_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'is_admin' = 'true'
        )
    );

-- Users can view their own transactions
CREATE POLICY "Users can view own credit transactions"
    ON credit_transactions
    FOR SELECT
    USING (user_id = auth.uid());