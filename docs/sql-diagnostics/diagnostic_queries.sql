-- =====================================================
-- DIAGNOSTIC QUERIES FOR GRANT TITLE ISSUE
-- Run these to understand what's in your database
-- =====================================================

-- 1. Check sample titles from org_grants_saved
SELECT 
  external_id,
  title,
  agency,
  CASE 
    WHEN title IS NULL THEN 'NULL'
    WHEN title = '' THEN 'EMPTY'
    WHEN title = 'Untitled Grant' THEN 'UNTITLED'
    WHEN title = 'Unnamed Grant' THEN 'UNNAMED'
    WHEN title ~ '^Grant [0-9]+$' THEN 'PLACEHOLDER'
    ELSE 'REAL'
  END as title_type
FROM public.org_grants_saved
ORDER BY id
LIMIT 10;

-- 2. Check sample titles from grants_catalog
SELECT 
  external_id,
  title,
  agency,
  source_key,
  is_active,
  CASE 
    WHEN title IS NULL THEN 'NULL'
    WHEN title = 'Untitled Grant' THEN 'UNTITLED'
    WHEN title ~ '^Grant [0-9]+$' THEN 'PLACEHOLDER'
    ELSE 'REAL'
  END as title_type
FROM public.grants_catalog
WHERE source_key = 'grants_gov'
ORDER BY id
LIMIT 10;

-- 3. Count placeholder titles in org_grants_saved
SELECT 
  'Placeholder "Grant XXXXX"' as pattern,
  COUNT(*) as count
FROM public.org_grants_saved
WHERE title ~ '^Grant [0-9]+$'
UNION ALL
SELECT 
  'Untitled Grant' as pattern,
  COUNT(*) as count
FROM public.org_grants_saved
WHERE title = 'Untitled Grant'
UNION ALL
SELECT 
  'NULL or Empty' as pattern,
  COUNT(*) as count
FROM public.org_grants_saved
WHERE title IS NULL OR title = '';

-- 4. Check grants that would be updated by migration
SELECT 
  ogs.external_id,
  ogs.title as saved_title,
  gc.title as catalog_title,
  ogs.agency as saved_agency,
  gc.agency as catalog_agency,
  CASE WHEN ogs.description IS NULL THEN 'NO DESC' ELSE 'HAS DESC' END as saved_desc_status,
  CASE WHEN gc.description IS NULL THEN 'NO DESC' ELSE 'HAS DESC' END as catalog_desc_status
FROM public.org_grants_saved ogs
INNER JOIN public.grants_catalog gc
  ON gc.external_id = ogs.external_id
  AND gc.source_key = 'grants_gov'
  AND gc.is_active = true
WHERE (
  ogs.title IS NULL
  OR ogs.title = ''
  OR ogs.title = 'Untitled Grant'
  OR ogs.title = 'Unnamed Grant'
  OR ogs.title ~ '^Grant [0-9]+$'
)
AND gc.title IS NOT NULL
AND gc.title != ''
AND gc.title != 'Untitled Grant'
AND gc.title != 'Unnamed Grant'
AND gc.title !~ '^Grant [0-9]+$'
LIMIT 20;

-- 5. Check if grants_catalog has placeholder titles
SELECT COUNT(*) as placeholder_count
FROM public.grants_catalog
WHERE source_key = 'grants_gov'
  AND (
    title = 'Untitled Grant'
    OR title ~ '^Grant [0-9]+$'
  );

-- 6. Check the 4 matched grants specifically
SELECT 
  ogs.external_id,
  ogs.title as org_title,
  gc.title as catalog_title,
  (ogs.title = gc.title) as titles_identical
FROM public.org_grants_saved ogs
INNER JOIN public.grants_catalog gc
  ON gc.external_id = ogs.external_id
  AND gc.source_key = 'grants_gov'
  AND gc.is_active = true
LIMIT 10;
