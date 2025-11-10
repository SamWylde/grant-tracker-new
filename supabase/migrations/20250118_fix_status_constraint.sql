-- Fix the status check constraint on org_grants_saved
-- Drop the existing constraint (it may have wrong values)
ALTER TABLE org_grants_saved
DROP CONSTRAINT IF EXISTS org_grants_saved_status_check;

-- Re-add the constraint with correct values
ALTER TABLE org_grants_saved
ADD CONSTRAINT org_grants_saved_status_check
CHECK (status IN ('researching', 'drafting', 'submitted', 'awarded', 'rejected', 'withdrawn'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'org_grants_saved'::regclass
AND conname = 'org_grants_saved_status_check';
