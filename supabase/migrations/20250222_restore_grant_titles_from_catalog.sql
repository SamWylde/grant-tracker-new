-- =====================================================
-- Restore Grant Titles and Descriptions from Catalog
-- Created: 2025-02-22
-- Purpose: Restore real grant titles and descriptions that were replaced with placeholders
-- =====================================================

DO $$
DECLARE
  v_total_matched INTEGER := 0;
  v_titles_restored INTEGER := 0;
  v_descriptions_restored INTEGER := 0;
  v_agencies_restored INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting grant data restoration from catalog...';

  -- Get total count of grants that can be matched with catalog
  SELECT COUNT(*) INTO v_total_matched
  FROM public.org_grants_saved ogs
  INNER JOIN public.grants_catalog gc
    ON gc.external_id = ogs.external_id
    AND gc.source_key = 'grants_gov'
    AND gc.is_active = true;

  RAISE NOTICE 'Found % grants in org_grants_saved that match grants_catalog', v_total_matched;

  -- =====================================================
  -- 1. RESTORE TITLES
  -- =====================================================
  RAISE NOTICE 'Restoring grant titles...';

  UPDATE public.org_grants_saved ogs
  SET
    title = gc.title,
    catalog_grant_id = gc.id  -- Also set the foreign key relationship
  FROM public.grants_catalog gc
  WHERE gc.external_id = ogs.external_id
    AND gc.source_key = 'grants_gov'
    AND gc.is_active = true
    -- Only update if current title is a placeholder
    AND (
      ogs.title IS NULL
      OR ogs.title = ''
      OR ogs.title = 'Untitled Grant'
      OR ogs.title = 'Unnamed Grant'
      OR ogs.title ~ '^Grant [0-9]+$'        -- Matches "Grant 58617" (POSIX regex)
      OR ogs.title ~ '^Custom Grant '        -- Matches "Custom Grant XXX"
    )
    -- Only update if catalog has a real title
    AND gc.title IS NOT NULL
    AND gc.title != ''
    AND gc.title != 'Untitled Grant'
    AND gc.title != 'Unnamed Grant'
    AND gc.title !~ '^Grant [0-9]+$';

  GET DIAGNOSTICS v_titles_restored = ROW_COUNT;
  RAISE NOTICE 'Updated % grant titles', v_titles_restored;

  -- =====================================================
  -- 2. RESTORE DESCRIPTIONS
  -- =====================================================
  RAISE NOTICE 'Restoring grant descriptions...';

  -- First, add description column if it doesn't exist
  ALTER TABLE public.org_grants_saved
    ADD COLUMN IF NOT EXISTS description TEXT;

  UPDATE public.org_grants_saved ogs
  SET description = gc.description
  FROM public.grants_catalog gc
  WHERE gc.external_id = ogs.external_id
    AND gc.source_key = 'grants_gov'
    AND gc.is_active = true
    -- Only update if current description is missing or minimal
    AND (
      ogs.description IS NULL
      OR ogs.description = ''
      OR LENGTH(ogs.description) < 50
    )
    -- Only update if catalog has substantial description
    AND gc.description IS NOT NULL
    AND LENGTH(gc.description) > 10;

  GET DIAGNOSTICS v_descriptions_restored = ROW_COUNT;
  RAISE NOTICE 'Updated % grant descriptions', v_descriptions_restored;

  -- =====================================================
  -- 3. RESTORE AGENCIES
  -- =====================================================
  RAISE NOTICE 'Restoring grant agencies...';

  UPDATE public.org_grants_saved ogs
  SET agency = gc.agency
  FROM public.grants_catalog gc
  WHERE gc.external_id = ogs.external_id
    AND gc.source_key = 'grants_gov'
    AND gc.is_active = true
    -- Only update if current agency is missing or placeholder
    AND (
      ogs.agency IS NULL
      OR ogs.agency = ''
      OR ogs.agency = 'Unknown'
      OR ogs.agency = 'N/A'
    )
    -- Only update if catalog has real agency
    AND gc.agency IS NOT NULL
    AND gc.agency != ''
    AND gc.agency != 'Unknown';

  GET DIAGNOSTICS v_agencies_restored = ROW_COUNT;
  RAISE NOTICE 'Updated % grant agencies', v_agencies_restored;

  -- =====================================================
  -- 4. SUMMARY
  -- =====================================================
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Grant data restoration completed:';
  RAISE NOTICE '  - Total grants matched with catalog: %', v_total_matched;
  RAISE NOTICE '  - Titles restored: %', v_titles_restored;
  RAISE NOTICE '  - Descriptions restored: %', v_descriptions_restored;
  RAISE NOTICE '  - Agencies restored: %', v_agencies_restored;
  RAISE NOTICE '================================================';
END $$;
