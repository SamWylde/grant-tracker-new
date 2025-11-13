-- =====================================================
-- Fix Untitled Grant and Unknown Agency Values
-- Created: 2025-02-21
-- Purpose: Replace placeholder values with actual grant identifiers
-- =====================================================

-- Fix grants_catalog: Replace "Untitled Grant" with grant number/ID
UPDATE public.grants_catalog
SET title = CONCAT('Grant ', COALESCE(opportunity_number, external_id))
WHERE title = 'Untitled Grant';

-- Fix grants_catalog: Set empty agency instead of 'Unknown'
UPDATE public.grants_catalog
SET agency = NULL
WHERE agency = 'Unknown';

-- Fix org_grants_saved: Replace "Untitled Grant" with grant external_id
UPDATE public.org_grants_saved
SET title = CONCAT('Grant ', external_id)
WHERE title = 'Untitled Grant';

-- Fix org_grants_saved: Set NULL agency instead of 'Unknown'
UPDATE public.org_grants_saved
SET agency = NULL
WHERE agency = 'Unknown';

-- Log the fixes
DO $$
DECLARE
  catalog_title_count INTEGER;
  catalog_agency_count INTEGER;
  saved_title_count INTEGER;
  saved_agency_count INTEGER;
BEGIN
  -- Get counts (these will be 0 after the updates, but useful for tracking)
  SELECT COUNT(*) INTO catalog_title_count FROM public.grants_catalog WHERE title LIKE 'Grant %' AND title != 'Untitled Grant';
  SELECT COUNT(*) INTO catalog_agency_count FROM public.grants_catalog WHERE agency IS NULL;
  SELECT COUNT(*) INTO saved_title_count FROM public.org_grants_saved WHERE title LIKE 'Grant %' AND title != 'Untitled Grant';
  SELECT COUNT(*) INTO saved_agency_count FROM public.org_grants_saved WHERE agency IS NULL;

  RAISE NOTICE 'Fixed grants in catalog with updated titles: %', catalog_title_count;
  RAISE NOTICE 'Fixed grants in catalog with NULL agencies: %', catalog_agency_count;
  RAISE NOTICE 'Fixed grants in org_grants_saved with updated titles: %', saved_title_count;
  RAISE NOTICE 'Fixed grants in org_grants_saved with NULL agencies: %', saved_agency_count;
END $$;
