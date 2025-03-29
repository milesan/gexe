CREATE TYPE user_status_enum AS ENUM (
    'no_user',
    'in_application_form',
    'application_sent_pending',
    'application_sent_rejected',
    'application_approved',
    'whitelisted',
    'admin'
);

CREATE TABLE user_status (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    status user_status_enum NOT NULL,
    welcome_screen_seen BOOLEAN DEFAULT FALSE,
    whitelist_signup_completed BOOLEAN DEFAULT FALSE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to update the timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on updates
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON user_status
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

/* Disabled for now
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Anyone reads their own status
CREATE POLICY read_own_status ON user_status
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins read all statuses
CREATE POLICY admin_read_all ON user_status
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_status 
        WHERE user_id = auth.uid() AND status = 'admin'
    )
);

-- Anyone can insert non-admin rows, super-admins can insert anything
CREATE POLICY allow_inserts ON user_status
FOR INSERT
TO authenticated
WITH CHECK (
    (status != 'admin' AND is_super_admin = FALSE)
    OR
    EXISTS (
        SELECT 1 FROM user_status 
        WHERE user_id = auth.uid() AND is_super_admin = TRUE
    )
);

-- Admins can update anything, but only super-admins can set admin fields
CREATE POLICY admin_updates ON user_status
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_status 
        WHERE user_id = auth.uid() AND status = 'admin'
    )
)
WITH CHECK (
    (status != 'admin' AND is_super_admin = FALSE)
    OR
    EXISTS (
        SELECT 1 FROM user_status 
        WHERE user_id = auth.uid() AND is_super_admin = TRUE
    )
);
*/