-- Update the Garden agreements house rules question to include the Tally.so link
UPDATE application_questions_2 
SET text = 'This place has some specific house rules. (https://tally.so/r/31Xay4) These include: no alcohol, no smoking on-site. Please read them carefully and make sure you can agree to them if you come. Everything else is between you and the ferns. Cool?'
WHERE id = '3744486e-edf6-460b-9021-2450743da2d9';

-- Verify the update
SELECT id, order_number, text, type, section 
FROM application_questions_2 
WHERE id = '3744486e-edf6-460b-9021-2450743da2d9';