-- Add program field to org_grants_saved table
-- This allows tracking grants by both agency and specific program within that agency

ALTER TABLE org_grants_saved
ADD COLUMN IF NOT EXISTS program TEXT;

-- Create index for better query performance on program field
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_program ON org_grants_saved(program);

-- Create index for combined agency+program queries
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_agency_program ON org_grants_saved(agency, program);

COMMENT ON COLUMN org_grants_saved.program IS 'Specific program within the funding agency (e.g., "Head Start" under HHS)';
