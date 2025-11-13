-- =====================================================
-- Expand Grant Pipeline Stages Migration
-- Created: 2025-02-07
-- Purpose: Add Go/No-Go, Not Funded, Closed Out, and Archived stages
-- =====================================================

-- Drop existing status constraint
ALTER TABLE org_grants_saved
DROP CONSTRAINT IF EXISTS org_grants_saved_status_check;

-- Add new constraint with expanded stages
-- Pipeline stages in logical order:
-- 1. researching (initial research phase)
-- 2. go-no-go (decision point before investing in drafting)
-- 3. drafting (actively writing application)
-- 4. submitted (application submitted, awaiting decision)
-- 5. awarded (application accepted)
-- 6. not-funded (application rejected/not funded)
-- 7. closed-out (awarded grant completed)
-- 8. rejected (rejected early in process)
-- 9. withdrawn (organization withdrew)
-- 10. archived (removed from active pipeline)
ALTER TABLE org_grants_saved
ADD CONSTRAINT org_grants_saved_status_check
CHECK (status IN (
  'researching',
  'go-no-go',
  'drafting',
  'submitted',
  'awarded',
  'not-funded',
  'closed-out',
  'rejected',
  'withdrawn',
  'archived'
));

-- Update comment to reflect new stages
COMMENT ON COLUMN org_grants_saved.status IS 'Pipeline stage: researching, go-no-go, drafting, submitted, awarded, not-funded, closed-out, rejected, withdrawn, archived';

-- Update approval workflows constraints to include new stages
ALTER TABLE approval_workflows
DROP CONSTRAINT IF EXISTS approval_workflows_from_stage_check;

ALTER TABLE approval_workflows
ADD CONSTRAINT approval_workflows_from_stage_check
CHECK (from_stage IN (
  'researching',
  'go-no-go',
  'drafting',
  'submitted',
  'awarded',
  'not-funded',
  'closed-out',
  'rejected',
  'withdrawn',
  'archived'
));

ALTER TABLE approval_workflows
DROP CONSTRAINT IF EXISTS approval_workflows_to_stage_check;

ALTER TABLE approval_workflows
ADD CONSTRAINT approval_workflows_to_stage_check
CHECK (to_stage IN (
  'researching',
  'go-no-go',
  'drafting',
  'submitted',
  'awarded',
  'not-funded',
  'closed-out',
  'rejected',
  'withdrawn',
  'archived'
));
