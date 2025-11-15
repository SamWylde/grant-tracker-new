-- Check Migration Status
-- Run this in Supabase SQL Editor to diagnose migration history issues

-- ============================================================================
-- 1. View all migrations currently recorded in remote database
-- ============================================================================
SELECT
    version,
    name,
    inserted_at,
    LENGTH(statements::text) as statement_size
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- ============================================================================
-- 2. Check for problematic migrations that don't exist locally
-- ============================================================================
SELECT
    version,
    name,
    'Does not exist in local migrations directory' as issue
FROM supabase_migrations.schema_migrations
WHERE version IN (
    '20250223_fix_signup_rls_policy',
    '20250223_fix_signup_rls_policy_secure',
    '20250223_fix_handle_new_user_rls',
    '20250108_create_org_grants_saved'
)
ORDER BY version;

-- ============================================================================
-- 3. List all 20250223 migrations (these should NOT exist)
-- ============================================================================
SELECT
    version,
    name,
    inserted_at,
    'Should be removed - replaced by 20250224' as action
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20250223%';

-- ============================================================================
-- 4. Check if the replacement migration exists
-- ============================================================================
SELECT
    version,
    name,
    inserted_at,
    CASE
        WHEN version = '20250224_fix_signup_rls' THEN 'Correct - this is the replacement'
        ELSE 'Unknown'
    END as status
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20250224%';

-- ============================================================================
-- 5. Count total migrations
-- ============================================================================
SELECT
    COUNT(*) as total_migrations,
    MIN(version) as earliest_migration,
    MAX(version) as latest_migration
FROM supabase_migrations.schema_migrations;

-- ============================================================================
-- 6. Expected local migrations (for comparison)
-- ============================================================================
-- Your local supabase/migrations/ directory should have these files:
--
-- 20250108_create_settings_and_org_schema.sql
-- 20250109_add_value_metrics_tracking.sql
-- 20250110_auto_create_organization.sql
-- 20250111_fix_org_members_rls.sql
-- 20250112_add_search_features.sql
-- 20250113_add_eligibility_profile.sql
-- 20250114_add_pipeline_fields.sql
-- 20250115_add_grant_tasks.sql
-- 20250116_add_grant_alerts.sql
-- 20250117_multi_source_ingestion.sql
-- 20250118_fix_status_constraint.sql
-- 20250119_add_user_profiles_foreign_key.sql
-- 20250120_fix_grant_org_id.sql
-- 20250121_add_activity_log.sql
-- 20250122_add_post_award_financials.sql
-- 20250123_add_grant_description.sql
-- 20250124_add_ai_features.sql
-- 20250125_add_collaboration_features.sql
-- 20250126_fix_activity_log_user_id.sql
-- 20250127_fix_collaboration_full_name.sql
-- 20250128_fix_activity_log_user_profiles_fkey.sql
-- 20250129_add_webhooks_and_integrations.sql
-- 20250130_add_platform_admin.sql
-- 20250131_update_plan_types.sql
-- 20250201_check_invitations_on_signup.sql
-- 20250202_backfill_missing_org_settings.sql
-- 20250203_add_document_management.sql
-- 20250204_add_document_storage_bucket.sql
-- 20250205_add_approval_workflows.sql
-- 20250206_add_scheduled_reports.sql
-- 20250207_add_funder_crm.sql
-- 20250208_add_google_calendar_event_id.sql
-- 20250209_add_loi_deadline.sql
-- 20250210_expand_grant_stages.sql
-- 20250214_add_two_factor_authentication.sql
-- 20250215_add_internal_deadlines.sql
-- 20250216_add_personal_data_exports.sql
-- 20250217_add_preflight_checklist.sql
-- 20250218_add_rbac_system.sql
-- 20250219_migrate_existing_roles.sql
-- 20250220_add_program_field.sql
-- 20250221_fix_untitled_and_unknown_grants.sql
-- 20250222_restore_grant_titles_from_catalog.sql
-- 20250224_fix_signup_rls.sql  <-- Note: 20250224, NOT 20250223!
--
-- Total: 44 migration files
--
-- Note the gaps: 20250211, 20250212, 20250213 don't exist - this is normal
-- The important thing: NO 20250223 files should exist locally
