-- =====================================================
-- FIX BAD DATA - NUCLEAR OPTIONS
-- WARNING: Only run these if you're sure!
-- =====================================================

-- OPTION 1: Delete ALL grants with placeholder titles
-- This forces them to be re-saved with real data
-- WARNING: This will remove grants from users' saved lists!
/*
DELETE FROM org_grants_saved 
WHERE title ~ '^Grant [0-9]+$' 
   OR title = 'Untitled Grant'
   OR title = 'Unnamed Grant';
*/

-- OPTION 2: Delete ALL grants (complete reset)
-- WARNING: This will delete ALL user-saved grants!
/*
DELETE FROM org_grants_saved;
*/

-- OPTION 3: Update placeholder titles to NULL (forces enrichment)
-- This keeps the grants but marks titles as missing
/*
UPDATE org_grants_saved
SET title = NULL
WHERE title ~ '^Grant [0-9]+$' 
   OR title = 'Untitled Grant'
   OR title = 'Unnamed Grant';
*/

-- OPTION 4: Manually restore from grants_catalog (if it has good data)
-- This is what the migration tries to do
/*
UPDATE org_grants_saved ogs
SET 
  title = gc.title,
  description = COALESCE(ogs.description, gc.description),
  agency = COALESCE(ogs.agency, gc.agency),
  catalog_grant_id = gc.id
FROM grants_catalog gc
WHERE gc.external_id = ogs.external_id
  AND gc.source_key = 'grants_gov'
  AND gc.is_active = true
  AND (ogs.title ~ '^Grant [0-9]+$' OR ogs.title = 'Untitled Grant')
  AND gc.title !~ '^Grant [0-9]+$'
  AND gc.title != 'Untitled Grant';
*/

-- OPTION 5: Check what WOULD be updated (dry run)
SELECT 
  ogs.external_id,
  ogs.title as old_title,
  gc.title as new_title,
  'WOULD UPDATE' as action
FROM org_grants_saved ogs
INNER JOIN grants_catalog gc
  ON gc.external_id = ogs.external_id
  AND gc.source_key = 'grants_gov'
  AND gc.is_active = true
WHERE (ogs.title ~ '^Grant [0-9]+$' OR ogs.title = 'Untitled Grant')
  AND gc.title !~ '^Grant [0-9]+$'
  AND gc.title != 'Untitled Grant'
LIMIT 20;
