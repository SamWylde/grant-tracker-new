-- =====================================================
-- COMPREHENSIVE DATABASE DIAGNOSTICS
-- Run these queries to understand the bad data problem
-- =====================================================

-- QUERY 1: What's actually in org_grants_saved?
-- Shows first 10 grants with their titles, descriptions, and agencies
SELECT 
  id,
  external_id,
  title,
  CASE 
    WHEN LENGTH(description) > 50 THEN LEFT(description, 50) || '...'
    ELSE COALESCE(description, 'NULL')
  END as description_preview,
  agency,
  created_at,
  CASE 
    WHEN title ~ '^Grant [0-9]+$' THEN 'PLACEHOLDER_TITLE'
    WHEN title = 'Untitled Grant' THEN 'PLACEHOLDER_TITLE'
    WHEN title IS NULL OR title = '' THEN 'MISSING_TITLE'
    ELSE 'REAL_TITLE'
  END as title_status
FROM org_grants_saved
ORDER BY created_at DESC
LIMIT 10;

-- QUERY 2: Count of good vs bad data in org_grants_saved
SELECT 
  COUNT(*) as total_grants,
  SUM(CASE WHEN title ~ '^Grant [0-9]+$' OR title = 'Untitled Grant' THEN 1 ELSE 0 END) as placeholder_titles,
  SUM(CASE WHEN title IS NULL OR title = '' THEN 1 ELSE 0 END) as missing_titles,
  SUM(CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END) as missing_descriptions,
  SUM(CASE WHEN agency IS NULL OR agency = '' OR agency = 'Unknown' THEN 1 ELSE 0 END) as missing_agencies
FROM org_grants_saved;

-- QUERY 3: What's in grants_catalog? (This is what the migration tries to restore FROM)
SELECT 
  id,
  external_id,
  source_key,
  title,
  CASE 
    WHEN LENGTH(description) > 50 THEN LEFT(description, 50) || '...'
    ELSE COALESCE(description, 'NULL')
  END as description_preview,
  agency,
  is_active,
  last_synced_at,
  CASE 
    WHEN title ~ '^Grant [0-9]+$' THEN 'PLACEHOLDER_TITLE'
    WHEN title = 'Untitled Grant' THEN 'PLACEHOLDER_TITLE'
    ELSE 'REAL_TITLE'
  END as title_status
FROM grants_catalog
WHERE source_key = 'grants_gov'
ORDER BY last_synced_at DESC NULLS LAST
LIMIT 10;

-- QUERY 4: Count of grants_catalog data quality
SELECT 
  source_key,
  COUNT(*) as total_grants,
  SUM(CASE WHEN title ~ '^Grant [0-9]+$' OR title = 'Untitled Grant' THEN 1 ELSE 0 END) as placeholder_titles,
  SUM(CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END) as missing_descriptions,
  MAX(last_synced_at) as last_sync
FROM grants_catalog
GROUP BY source_key;

-- QUERY 5: Check specific grant "350138"
SELECT 
  'org_grants_saved' as table_name,
  id,
  external_id,
  title,
  LEFT(COALESCE(description, 'NULL'), 100) as description_preview,
  agency
FROM org_grants_saved
WHERE external_id LIKE '%350138%'
UNION ALL
SELECT 
  'grants_catalog' as table_name,
  id::text,
  external_id,
  title,
  LEFT(COALESCE(description, 'NULL'), 100) as description_preview,
  agency
FROM grants_catalog
WHERE external_id LIKE '%350138%';

-- QUERY 6: Matching analysis - can migration restore data?
-- Shows which grants in org_grants_saved COULD be restored from grants_catalog
SELECT 
  ogs.external_id,
  ogs.title as saved_title,
  gc.title as catalog_title,
  CASE 
    WHEN gc.id IS NULL THEN 'NOT_IN_CATALOG'
    WHEN gc.title ~ '^Grant [0-9]+$' OR gc.title = 'Untitled Grant' THEN 'CATALOG_HAS_PLACEHOLDER'
    ELSE 'CAN_RESTORE'
  END as restore_status,
  CASE WHEN ogs.description IS NULL THEN 'NO' ELSE 'YES' END as has_saved_desc,
  CASE WHEN gc.description IS NULL THEN 'NO' ELSE 'YES' END as has_catalog_desc
FROM org_grants_saved ogs
LEFT JOIN grants_catalog gc 
  ON gc.external_id = ogs.external_id 
  AND gc.source_key = 'grants_gov'
  AND gc.is_active = true
WHERE ogs.title ~ '^Grant [0-9]+$' OR ogs.title = 'Untitled Grant'
LIMIT 20;

-- QUERY 7: Check sync jobs - has the catalog ever been populated?
SELECT 
  id,
  source_id,
  job_type,
  status,
  grants_fetched,
  grants_created,
  grants_updated,
  error_message,
  completed_at
FROM sync_jobs
ORDER BY created_at DESC
LIMIT 10;

-- QUERY 8: Check grant sources configuration
SELECT 
  source_key,
  source_name,
  sync_enabled,
  last_sync_at,
  next_sync_at
FROM grant_sources;

-- QUERY 9: Find ALL grants with placeholder titles
SELECT 
  external_id,
  title,
  agency,
  created_at
FROM org_grants_saved
WHERE title ~ '^Grant [0-9]+$' 
   OR title = 'Untitled Grant'
   OR title = 'Unnamed Grant'
ORDER BY created_at DESC;

-- QUERY 10: Sample of GOOD data (if any exists)
SELECT 
  external_id,
  title,
  LEFT(description, 100) as description_preview,
  agency
FROM org_grants_saved
WHERE title !~ '^Grant [0-9]+$' 
  AND title != 'Untitled Grant'
  AND title IS NOT NULL
  AND title != ''
LIMIT 5;
