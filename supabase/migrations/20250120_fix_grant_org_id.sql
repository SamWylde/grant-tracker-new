-- Fix grants with missing org_id
-- This migration ensures all grants have a valid org_id

-- First, log any grants that have null org_id
DO $$
DECLARE
  null_org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_org_count
  FROM org_grants_saved
  WHERE org_id IS NULL;

  IF null_org_count > 0 THEN
    RAISE NOTICE 'Found % grants with null org_id', null_org_count;
  END IF;
END $$;

-- For any grants with null org_id, try to assign them to the user's first organization
-- If the user has no organization, delete the grant (it's orphaned data)
UPDATE org_grants_saved
SET org_id = (
  SELECT om.org_id
  FROM org_members om
  WHERE om.user_id = org_grants_saved.user_id
  LIMIT 1
)
WHERE org_id IS NULL
AND EXISTS (
  SELECT 1
  FROM org_members om
  WHERE om.user_id = org_grants_saved.user_id
);

-- Delete any remaining grants with null org_id (orphaned data with no user organization)
DELETE FROM org_grants_saved
WHERE org_id IS NULL;

-- Ensure org_id is NOT NULL constraint is enforced
ALTER TABLE org_grants_saved
ALTER COLUMN org_id SET NOT NULL;

COMMENT ON COLUMN org_grants_saved.org_id IS 'Organization ID - required for all grants';
