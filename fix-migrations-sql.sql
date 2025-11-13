-- Fix Migration History - SQL Approach
-- Run this in your Supabase SQL Editor to fix the migration history mismatch
-- This removes references to deleted/renamed migrations from the remote database

-- First, let's see what migrations are currently recorded
SELECT version, name, statements, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- Check specifically for the problematic migrations
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20250223%'
   OR version = '20250108_create_org_grants_saved'
ORDER BY version;

-- ============================================================================
-- FIX: Remove migrations that no longer exist in local directory
-- ============================================================================

-- Remove the 20250223 migrations that were deleted/renamed locally
-- These were replaced with 20250224_fix_signup_rls.sql

BEGIN;

-- Remove 20250223_fix_signup_rls_policy (deleted due to security vulnerability)
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20250223_fix_signup_rls_policy';

-- Remove 20250223_fix_signup_rls_policy_secure (deleted, replaced with 20250224)
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20250223_fix_signup_rls_policy_secure';

-- Remove 20250223_fix_handle_new_user_rls (renamed to 20250224_fix_signup_rls)
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20250223_fix_handle_new_user_rls';

-- Remove 20250108_create_org_grants_saved if it exists
-- (This was deleted from local migrations directory)
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20250108_create_org_grants_saved';

-- Show what was deleted
SELECT 'Removed problematic migration records' as status;

COMMIT;

-- ============================================================================
-- VERIFICATION: Check the migration history after fix
-- ============================================================================

-- List all migrations currently in the history
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- Verify no 20250223 migrations remain
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN 'SUCCESS: No problematic 20250223 migrations found'
        ELSE 'WARNING: Found ' || COUNT(*)::text || ' problematic migrations'
    END as verification_result
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20250223%';

-- ============================================================================
-- Expected migrations after fix (for reference)
-- ============================================================================

-- After running this fix, your migration history should include:
-- 20250108_create_settings_and_org_schema
-- 20250109_add_value_metrics_tracking
-- 20250110_auto_create_organization
-- ... (all the migrations through 20250222)
-- 20250224_fix_signup_rls (NOT 20250223!)
--
-- The key point: NO 20250223 versions should exist
-- They were replaced with 20250224_fix_signup_rls.sql

-- ============================================================================
-- AFTER running this SQL, try the push command again:
-- npx supabase db push --include-all
-- ============================================================================
