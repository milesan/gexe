-- Add new application questions for dates and accommodation selection
-- These will be displayed during the application process

-- First, let's get the max order number to append our new questions
DO $$
DECLARE
  v_max_order INTEGER;
BEGIN
  SELECT COALESCE(MAX(order_number), 0) INTO v_max_order FROM application_questions_2;
  
  -- Insert date selection questions
  INSERT INTO application_questions_2 (
    id,
    order_number,
    text,
    type,
    required,
    section,
    help_text,
    visibility_rules
  ) VALUES 
  (
    'c1234567-89ab-cdef-0123-456789abcdef',
    v_max_order + 1,
    'When would you like to arrive?',
    'date',
    true,
    'stay',
    'Select your desired check-in date',
    NULL
  ),
  (
    'c2234567-89ab-cdef-0123-456789abcdef',
    v_max_order + 2,
    'When would you like to depart?',
    'date',
    true,
    'stay',
    'Select your desired check-out date',
    NULL
  ),
  (
    'c3234567-89ab-cdef-0123-456789abcdef',
    v_max_order + 3,
    'What type of accommodation would you prefer?',
    'accommodation_selector',
    true,
    'stay',
    'Select your preferred accommodation type. You can change this later if approved.',
    NULL
  );
  
  -- Update the muse question order to come after accommodation selection
  UPDATE application_questions_2
  SET order_number = v_max_order + 4
  WHERE text LIKE '%muse or artisan%';
  
END $$;