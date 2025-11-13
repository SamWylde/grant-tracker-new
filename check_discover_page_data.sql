-- =====================================================
-- CHECK DISCOVER PAGE DATA (grants_catalog table)
-- =====================================================
-- The Discover page uses /api/grants/search-catalog
-- which queries the grants_catalog table

-- 1. HOW MANY GRANTS IN CATALOG?
SELECT
  COUNT(*) as total_grants,
  SUM(CASE WHEN title ~ '^Grant [0-9]+$' OR title = 'Untitled Grant' THEN 1 ELSE 0 END) as bad_titles,
  SUM(CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END) as no_description,
  SUM(CASE WHEN agency IS NULL OR agency = '' THEN 1 ELSE 0 END) as no_agency
FROM grants_catalog
WHERE source_key = 'grants_gov' AND is_active = true;

-- 2. SAMPLE OF WHAT'S ACTUALLY IN THE CATALOG (first 20 grants)
SELECT
  external_id,
  title,
  LEFT(COALESCE(description, 'NULL'), 80) as description_preview,
  agency,
  opportunity_status,
  last_synced_at
FROM grants_catalog
WHERE source_key = 'grants_gov' AND is_active = true
ORDER BY last_synced_at DESC NULLS LAST
LIMIT 20;

-- 3. CHECK WHEN CATALOG WAS LAST SYNCED
SELECT
  source_name,
  last_sync_at,
  next_sync_at,
  sync_enabled
FROM grant_sources
WHERE source_key = 'grants_gov';

-- 4. CHECK SYNC JOB HISTORY
SELECT
  id,
  status,
  grants_fetched,
  grants_created,
  grants_updated,
  error_message,
  started_at,
  completed_at
FROM sync_jobs
WHERE source_id = (SELECT id FROM grant_sources WHERE source_key = 'grants_gov')
ORDER BY created_at DESC
LIMIT 5;

-- 5. COUNT BAD TITLES BY PATTERN
SELECT
  CASE
    WHEN title = 'Untitled Grant' THEN 'Untitled Grant'
    WHEN title ~ '^Grant [0-9]+$' THEN 'Grant [number]'
    WHEN title IS NULL OR title = '' THEN 'NULL/Empty'
    ELSE 'Good Title'
  END as title_type,
  COUNT(*) as count
FROM grants_catalog
WHERE source_key = 'grants_gov' AND is_active = true
GROUP BY title_type
ORDER BY count DESC;
