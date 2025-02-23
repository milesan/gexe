-- Fix application data indices by shifting them down by 2 to match question order_numbers
-- This aligns the database with the frontend question IDs

-- Step 1: Add linked_application_id column if it doesn't exist
ALTER TABLE applications ADD COLUMN IF NOT EXISTS linked_application_id uuid REFERENCES applications(id);

-- Step 2: Add a temporary column
ALTER TABLE applications ADD COLUMN data_new jsonb;

-- Step 3: Copy data with adjusted indices (shifting down by 2)
UPDATE applications
SET data_new = jsonb_build_object(
  '1', data->>'3',  -- Data consent
  '2', data->>'4',  -- First name
  '3', data->>'5',  -- Last name
  '4', data->>'6',  -- Where aren't you from
  '5', data->>'7',  -- Email
  '6', data->>'8',  -- Referral
  '7', data->>'9',  -- Muse/artisan
  '8', data->>'10', -- Applying with someone
  '9', data->>'11', -- WhatsApp
  '10', data->>'12', -- Social media
  '11', data->>'13', -- Current life status
  '12', data->>'14', -- Why The Garden
  '13', data->>'15', -- Photos
  '14', data->>'16', -- Proud creation
  '15', data->>'17', -- Hurt feelings
  '16', data->>'18', -- Changed belief
  '17', data->>'19', -- If we really knew you
  '18', data->>'20', -- Working on
  '19', data->>'21', -- Getting to know people
  '20', data->>'22', -- Questions for strangers
  '21', data->>'23', -- Identity
  '22', data->>'24', -- Taboo topics
  '23', data->>'25', -- Conspiracy theory
  '24', data->>'26', -- Unique belief
  '25', data->>'27', -- Astrology
  '26', data->>'28', -- Logic puzzle
  '27', data->>'29', -- MBTI type
  '28', data->>'30', -- Additional Information
  '30', data->>'32', -- Additional Question
  '32', data->>'34', -- Pet Policy Agreement
  '33', data->>'35'  -- Final Agreement
);

-- Step 4: Verify the data looks correct (you can check a few rows)
-- SELECT id, data->>'3' as old_consent, data_new->>'1' as new_consent FROM applications LIMIT 5;

-- Step 5: Drop the view first, then update the table
DROP VIEW IF EXISTS application_details;

-- Step 6: Replace old data with new
ALTER TABLE applications DROP COLUMN data;
ALTER TABLE applications RENAME COLUMN data_new TO data;

-- Step 7: Recreate the view
CREATE VIEW application_details AS
SELECT 
    a.id,
    a.user_id,
    a.data,
    a.status,
    a.created_at,
    a.updated_at,
    u.email as user_email,
    linked.data->>'2' as linked_name,
    linked.data->>'5' as linked_email,
    a.linked_application_id,
    linked_user.email as linked_user_email
FROM applications a
LEFT JOIN auth.users u ON u.id = a.user_id
LEFT JOIN applications linked ON linked.id = a.linked_application_id
LEFT JOIN auth.users linked_user ON linked_user.id = linked.user_id;
