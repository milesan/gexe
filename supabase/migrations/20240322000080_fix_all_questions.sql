-- First, clean up all existing questions
TRUNCATE application_questions;

-- Insert all questions with proper order and formatting
INSERT INTO application_questions (
  order_number,
  text,
  type,
  options,
  required,
  section
) VALUES 
(1, 'I consent to my data being stored and reviewed for the process of this residency.', 
 'radio', 
 '["Yes", "No [if you click this, we can''t review your application]"]'::jsonb,
 true, 
 'intro'),

(2, 'First Name', 
 'text',
 NULL,
 true, 
 'personal'),

(3, 'Last Name', 
 'text',
 NULL,
 true, 
 'personal'),

(4, 'So, where aren''t you from?', 
 'text',
 NULL,
 false, 
 'personal'),

(5, 'What is your email address?', 
 'email',
 NULL,
 true, 
 'personal'),

(6, 'Who, if anyone, referred you?', 
 'text',
 NULL,
 false, 
 'personal'),

(7, 'Applying as a muse or artisan? Muses receive a 50% discount on their stay (not including accom), and are asked to provide their skills 7h/week.', 
 'radio', 
 '["Yes, I want to be a muse", "No, I prefer to be a regular guest"]'::jsonb,
 true, 
 'stay'),

(8, 'Are you applying with someone else? [like a partner, friend, or family?]',
 'radio',
 '["Yes!", "No, applying solo"]'::jsonb,
 true,
 'stay'),

(9, 'What is your # [Whatsapp preferred]', 
 'tel',
 NULL,
 false, 
 'personal'),

(10, 'Is there any web or social media presence you''d like to share?', 
 'text',
 NULL,
 false, 
 'personal'),

(11, 'Where are you at in your life right now? Max 80 words, please.', 
 'textarea',
 NULL,
 false, 
 'personal'),

(12, 'Why do you want to spend time at the Garden? What''s your intention? What do you seek?', 
 'textarea',
 NULL,
 false, 
 'personal'),

(13, 'What photo(s) of you best captures your essence? No more than 3, please.', 
 'file',
 NULL,
 false, 
 'personal'),

(14, 'What''s something you''ve created / built that you''re proud of?', 
 'textarea',
 NULL,
 false, 
 'personal'),

(15, 'If someone hurt your feelings, did they do something wrong?', 
 'textarea',
 NULL,
 true, 
 'philosophy'),

(16, 'What a recent belief you changed?', 
 'textarea',
 NULL,
 false, 
 'philosophy'),

(17, 'If we really knew you, what would we know?', 
 'textarea',
 NULL,
 false, 
 'philosophy'),

(18, 'What is something about yourself that you''re working on?', 
 'textarea',
 NULL,
 false, 
 'philosophy'),

(19, 'What''s your ideal way of getting to know a new person?', 
 'textarea',
 NULL,
 false, 
 'philosophy'),

(20, 'What questions, if any, do you like to ask strangers?', 
 'textarea',
 NULL,
 true, 
 'philosophy'),

(21, 'How do you identify yourself?', 
 'textarea',
 NULL,
 false, 
 'philosophy'),

(22, 'Are there any topics which are not OK to discuss?', 
 'textarea',
 NULL,
 false, 
 'philosophy'),

(23, 'What''s your favorite conspiracy theory?', 
 'textarea',
 NULL,
 false, 
 'philosophy'),

(24, 'What do you believe is true that most other people believe is false?', 
 'textarea',
 NULL,
 false, 
 'philosophy'),

(25, 'What, if anything, does astrology mean to you?', 
 'textarea',
 NULL,
 false, 
 'philosophy'),

(26, 'If some robots are mechanics and some mechanics are purple, does it logically follow that some robots must be purple?', 
 'textarea',
 NULL,
 false, 
 'philosophy'),

(27, 'Do you believe an old book gives you claim to a piece of land?', 
 'textarea',
 NULL,
 true, 
 'philosophy'),

(28, 'How many times have you been vaccinated for COVID & how do you feel about that?', 
 'textarea',
 NULL,
 true, 
 'health'),

(29, 'If you know it, what is your MBTI type?', 
 'text',
 NULL,
 false, 
 'personal');