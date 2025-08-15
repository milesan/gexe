-- First, let's see all questions to find the Garden agreements
SELECT id, order_number, text, type, section 
FROM application_questions_2 
ORDER BY order_number;

-- Look specifically for the house rules/agreements question
SELECT id, order_number, text, type, section 
FROM application_questions_2 
WHERE text LIKE '%house rules%' 
   OR text LIKE '%ferns%'
   OR text LIKE '%alcohol%'
   OR text LIKE '%smoking%'
   OR text LIKE '%specific%'
   OR text LIKE '%agreement%'
   OR text LIKE '%Cool?%'
   OR section = 'agreements'
   OR type = 'checkbox'
   OR order_number >= 30; -- Agreement questions are usually at the end

-- Once you find the correct question, update it with:
UPDATE application_questions_2 
SET text = 'This place has some specific house rules. (https://tally.so/r/31Xay4) These include: no alcohol, no smoking on-site. Please read them carefully and make sure you can agree to them if you come. Everything else is between you and the ferns. Cool?'
WHERE text LIKE '%This place has some specific house rules%'
   OR text LIKE '%no alcohol, no smoking%'
   OR text LIKE '%between you and the ferns%';