-- Fix question order numbers to start from 1 and application data to match

-- First, create a temporary table to hold question mappings
CREATE TEMPORARY TABLE question_number_map AS
SELECT 
    id,
    order_number as old_number,
    order_number - 2 as new_number
FROM application_questions;

-- First shift questions to temporary high numbers to avoid conflicts
UPDATE application_questions
SET order_number = order_number + 1000;

-- Now shift them to their final positions
UPDATE application_questions
SET order_number = order_number - 1002;  -- (1000 from step 1 + 2 from original offset)

-- Add temporary column for new data
ALTER TABLE applications ADD COLUMN data_new jsonb;

-- Update application data to use new question numbers
UPDATE applications
SET data_new = jsonb_object_agg(
    CASE 
        WHEN key::int >= 3 THEN (key::int - 2)::text 
        ELSE key
    END,
    value
)
FROM (
    SELECT id, jsonb_each(data) AS data_pair
    FROM applications
) AS t
WHERE t.id = applications.id;

-- Verify a few rows to make sure the data looks correct
-- SELECT 
--     a.id,
--     a.data->>'3' as old_consent,
--     a.data_new->>'1' as new_consent,
--     a.data->>'4' as old_first_name,
--     a.data_new->>'2' as new_first_name
-- FROM applications a LIMIT 5;

-- If everything looks good, swap the columns
ALTER TABLE applications DROP COLUMN data;
ALTER TABLE applications RENAME COLUMN data_new TO data;

-- Drop our temporary table
DROP TABLE question_number_map;

-- Output the new order numbers to verify
-- SELECT order_number, text 
-- FROM application_questions 
-- ORDER BY order_number;
