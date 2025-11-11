-- Add description column to org_grants_saved table
-- This allows us to show description previews on grant cards

ALTER TABLE org_grants_saved
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN org_grants_saved.description IS 'Grant description/synopsis for preview on cards';

-- Update RLS policies remain the same, description is part of the grant data
