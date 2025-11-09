-- Migration: Add Pipeline/Workflow Fields to org_grants_saved
-- Description: Adds status tracking and workflow fields for Kanban pipeline view

-- Add status field for pipeline stages
ALTER TABLE org_grants_saved
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'researching'
CHECK (status IN ('researching', 'drafting', 'submitted', 'awarded', 'rejected', 'withdrawn'));

-- Add additional workflow fields
ALTER TABLE org_grants_saved
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_status ON org_grants_saved(org_id, status);
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_assigned ON org_grants_saved(assigned_to);

-- Add comments
COMMENT ON COLUMN org_grants_saved.status IS 'Pipeline stage: researching, drafting, submitted, awarded, rejected, withdrawn';
COMMENT ON COLUMN org_grants_saved.assigned_to IS 'Team member assigned to this grant';
COMMENT ON COLUMN org_grants_saved.priority IS 'Priority level for this grant';
COMMENT ON COLUMN org_grants_saved.stage_updated_at IS 'Timestamp when status was last changed';
COMMENT ON COLUMN org_grants_saved.notes IS 'Internal notes about this grant';

-- Function to auto-update stage_updated_at when status changes
CREATE OR REPLACE FUNCTION update_stage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.stage_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER update_grant_stage_timestamp
  BEFORE UPDATE ON org_grants_saved
  FOR EACH ROW
  EXECUTE FUNCTION update_stage_timestamp();

-- Set default stage_updated_at for existing records
UPDATE org_grants_saved
SET stage_updated_at = saved_at
WHERE stage_updated_at IS NULL;
