-- Add new application questions for dates and accommodation selection
-- INITIALLY HIDDEN to not disrupt current application flow
-- Set visible = true when ready to enable the new flow

-- First, check if we have a visible column, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'application_questions_2' 
    AND column_name = 'visible'
  ) THEN
    ALTER TABLE application_questions_2 
    ADD COLUMN visible BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Now add the new questions (hidden by default)
DO $$
DECLARE
  v_max_order INTEGER;
BEGIN
  SELECT COALESCE(MAX(order_number), 0) INTO v_max_order FROM application_questions_2;
  
  -- Insert date selection questions (HIDDEN by default with visible = false)
  INSERT INTO application_questions_2 (
    id,
    order_number,
    text,
    type,
    required,
    section,
    help_text,
    visibility_rules,
    visible  -- SET TO FALSE INITIALLY
  ) VALUES 
  (
    'c1234567-89ab-cdef-0123-456789abcdef',
    v_max_order + 1,
    'When would you like to arrive?',
    'date',
    false,  -- Not required initially
    'stay',
    'Select your desired check-in date',
    NULL,
    false  -- HIDDEN
  ),
  (
    'c2234567-89ab-cdef-0123-456789abcdef',
    v_max_order + 2,
    'When would you like to depart?',
    'date',
    false,  -- Not required initially
    'stay',
    'Select your desired check-out date',
    NULL,
    false  -- HIDDEN
  ),
  (
    'c3234567-89ab-cdef-0123-456789abcdef',
    v_max_order + 3,
    'What type of accommodation would you prefer?',
    'accommodation_selector',
    false,  -- Not required initially
    'stay',
    'Select your preferred accommodation type. You can change this later if approved.',
    NULL,
    false  -- HIDDEN
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent duplicate inserts if migration runs twice
  
  -- Don't update any existing question orders - keep current flow intact
  
END $$;

-- Add a comment explaining how to enable the new flow
COMMENT ON COLUMN application_questions_2.visible IS 
'Controls whether question appears in application. Set date/accommodation questions to visible=true when ready to enable new voice flow.';