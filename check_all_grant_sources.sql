-- =====================================================
-- CHECK ALL GRANT DATA SOURCES
-- =====================================================

-- WHERE ARE YOU SEEING THE GRANTS?
-- Different pages pull from different tables!

-- 1. SAVED GRANTS PAGE / PIPELINE PAGE
-- Uses: /api/saved → org_grants_saved table
SELECT 
  'org_grants_saved' as source,
  COUNT(*) as total,
  SUM(CASE WHEN title ~ '^Grant [0-9]+$' OR title = 'Untitled Grant' THEN 1 ELSE 0 END) as bad_titles,
  SUM(CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END) as no_description
FROM org_grants_saved;

-- 2. DISCOVER PAGE (CATALOG MODE)
-- Uses: /api/grants/search-catalog → grants_catalog table
SELECT 
  'grants_catalog' as source,
  COUNT(*) as total,
  SUM(CASE WHEN title ~ '^Grant [0-9]+$' OR title = 'Untitled Grant' THEN 1 ELSE 0 END) as bad_titles,
  SUM(CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END) as no_description
FROM grants_catalog
WHERE source_key = 'grants_gov';

-- 3. SAMPLE DATA FROM GRANTS_CATALOG
-- This is what you see on Discover page if catalog has data
SELECT 
  external_id,
  title,
  LEFT(COALESCE(description, 'NULL'), 60) as description_preview,
  agency,
  last_synced_at
FROM grants_catalog
WHERE source_key = 'grants_gov'
ORDER BY last_synced_at DESC NULLS LAST
LIMIT 10;

-- 4. CHECK IF CATALOG IS COMPLETELY EMPTY
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'CATALOG IS EMPTY - CRON NEVER RAN'
    ELSE CONCAT('Catalog has ', COUNT(*), ' grants')
  END as catalog_status
FROM grants_catalog;

-- 5. ALL GRANTS FROM ALL SOURCES (UNION)
SELECT 
  'org_grants_saved' as table_name,
  external_id,
  title,
  LEFT(COALESCE(description, 'NULL'), 50) as desc_preview
FROM org_grants_saved
UNION ALL
SELECT 
  'grants_catalog' as table_name,
  external_id,
  title,
  LEFT(COALESCE(description, 'NULL'), 50) as desc_preview
FROM grants_catalog
WHERE source_key = 'grants_gov';
