-- Migration: Rename capacity to inventory
-- This migration renames the 'capacity' column to 'inventory' in the accommodations table
-- and updates all references in views, functions, and constraints

BEGIN;

-- 1. First, rename the column
ALTER TABLE accommodations 
RENAME COLUMN capacity TO inventory;

-- 2. Update the constraint name and check for consistency
-- Note: The constraint will automatically be updated with the column rename

-- 3. Update any views that reference the old column name
-- (Based on the search, there don't appear to be any views directly referencing 'capacity')

-- 4. Update any functions that might reference the capacity column
-- (Based on the search, no stored procedures directly reference a.capacity)

-- Commit the changes
COMMIT; 