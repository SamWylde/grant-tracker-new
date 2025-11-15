-- =====================================================
-- QUICK FIX FOR YOUR 1 BAD GRANT
-- =====================================================

-- First, let's see which grant has the placeholder title
SELECT 
  id,
  external_id,
  title,
  agency,
  LEFT(COALESCE(description, 'NULL'), 50) as description_preview
FROM org_grants_saved
WHERE title ~ '^Grant [0-9]+$' 
   OR title = 'Untitled Grant';

-- Check if grants_catalog is empty (cron failed)
SELECT COUNT(*) as catalog_grant_count FROM grants_catalog;

-- Check specific grant 350138 in org_grants_saved
SELECT 
  id,
  external_id,
  title,
  agency,
  description
FROM org_grants_saved
WHERE external_id = '350138';

-- Check if it exists in grants_catalog
SELECT 
  id,
  external_id,
  title,
  agency,
  description
FROM grants_catalog
WHERE external_id = '350138';

-- =====================================================
-- OPTION 1: Delete just the bad grant (RECOMMENDED)
-- The API will now fetch it properly when you re-save it
-- =====================================================
/*
DELETE FROM org_grants_saved 
WHERE title ~ '^Grant [0-9]+$' 
   OR title = 'Untitled Grant';
*/

-- =====================================================
-- OPTION 2: If grants_catalog has the real data, restore it
-- =====================================================
/*
UPDATE org_grants_saved ogs
SET 
  title = gc.title,
  description = COALESCE(ogs.description, gc.description),
  agency = COALESCE(ogs.agency, gc.agency)
FROM grants_catalog gc
WHERE gc.external_id = ogs.external_id
  AND (ogs.title ~ '^Grant [0-9]+$' OR ogs.title = 'Untitled Grant')
  AND gc.title !~ '^Grant [0-9]+$';
*/
