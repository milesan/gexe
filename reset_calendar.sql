-- Delete all existing customizations
DELETE FROM week_customizations WHERE TRUE;

-- Add new customizations for testing different scenarios
INSERT INTO week_customizations (start_date, end_date, name, status) VALUES
-- Regular visible week
('2024-12-22', '2024-12-28', 'Christmas Week', 'visible'),

-- Hidden week
('2024-12-29', '2025-01-04', 'New Years Week', 'hidden'),

-- Deleted week
('2025-01-05', '2025-01-11', 'First Week of January', 'deleted'),

-- Custom length week (longer than default)
('2025-01-12', '2025-01-25', 'Extended Stay Week', 'visible'),

-- Custom length week (shorter than default)
('2025-02-01', '2025-02-04', 'Short Stay Week', 'visible'),

-- Overlapping weeks to test handling
('2025-02-10', '2025-02-20', 'Low Season Break Part 1', 'visible'),