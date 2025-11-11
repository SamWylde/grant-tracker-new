-- =====================================================
-- Fix Collaboration Features - Correct Schema References
-- Created: 2025-11-11
-- Purpose: Fix references to full_name from org_members to user_profiles
--
-- IMPORTANT: This migration only applies if you already ran the old version
-- of 20250125_add_collaboration_features.sql. If you haven't run that migration
-- yet, this fix is not needed - just run the base migration which now has the
-- correct schema.
-- =====================================================

DO $$
DECLARE
  view_exists BOOLEAN;
BEGIN
  -- Check if activity_stream view exists (indicates base migration was run)
  SELECT EXISTS (
    SELECT FROM pg_views
    WHERE schemaname = 'public'
    AND viewname = 'activity_stream'
  ) INTO view_exists;

  IF NOT view_exists THEN
    RAISE NOTICE 'Collaboration features not installed yet. Run 20250125_add_collaboration_features.sql first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Updating activity_stream view with correct user_profiles schema...';

  -- =====================================================
  -- 1. FIX ACTIVITY STREAM VIEW
  -- =====================================================
  EXECUTE '
  CREATE OR REPLACE VIEW public.activity_stream AS
  -- Grant comments
  SELECT
    ''grant_comment'' AS activity_type,
    gc.id AS activity_id,
    gc.org_id,
    gc.user_id,
    gc.grant_id AS related_grant_id,
    NULL::UUID AS related_task_id,
    gc.content,
    gc.parent_comment_id,
    gc.mentioned_user_ids,
    gc.created_at,
    u.email AS user_email,
    COALESCE(up.full_name, u.email) AS user_name,
    ogs.title AS grant_title,
    NULL AS task_title
  FROM public.grant_comments gc
  JOIN auth.users u ON gc.user_id = u.id
  LEFT JOIN public.user_profiles up ON gc.user_id = up.id
  LEFT JOIN public.org_grants_saved ogs ON gc.grant_id = ogs.id
  WHERE gc.is_deleted = FALSE

  UNION ALL

  -- Task comments
  SELECT
    ''task_comment'' AS activity_type,
    tc.id AS activity_id,
    tc.org_id,
    tc.user_id,
    gt.grant_id AS related_grant_id,
    tc.task_id AS related_task_id,
    tc.content,
    tc.parent_comment_id,
    tc.mentioned_user_ids,
    tc.created_at,
    u.email AS user_email,
    COALESCE(up.full_name, u.email) AS user_name,
    ogs.title AS grant_title,
    gt.title AS task_title
  FROM public.task_comments tc
  JOIN auth.users u ON tc.user_id = u.id
  LEFT JOIN public.user_profiles up ON tc.user_id = up.id
  LEFT JOIN public.grant_tasks gt ON tc.task_id = gt.id
  LEFT JOIN public.org_grants_saved ogs ON gt.grant_id = ogs.id
  WHERE tc.is_deleted = FALSE

  UNION ALL

  -- Mention notifications
  SELECT
    ''mention'' AS activity_type,
    mn.id AS activity_id,
    mn.org_id,
    mn.mentioned_by_user_id AS user_id,
    CASE
      WHEN mn.grant_comment_id IS NOT NULL THEN gc.grant_id
      WHEN mn.task_comment_id IS NOT NULL THEN gt.grant_id
    END AS related_grant_id,
    CASE
      WHEN mn.task_comment_id IS NOT NULL THEN tc.task_id
    END AS related_task_id,
    CONCAT(''@'', COALESCE(target_up.full_name, target_u.email)) AS content,
    NULL::UUID AS parent_comment_id,
    ARRAY[mn.user_id]::UUID[] AS mentioned_user_ids,
    mn.created_at,
    u.email AS user_email,
    COALESCE(up.full_name, u.email) AS user_name,
    mn.context_title AS grant_title,
    NULL AS task_title
  FROM public.mention_notifications mn
  JOIN auth.users u ON mn.mentioned_by_user_id = u.id
  LEFT JOIN public.user_profiles up ON mn.mentioned_by_user_id = up.id
  JOIN auth.users target_u ON mn.user_id = target_u.id
  LEFT JOIN public.user_profiles target_up ON mn.user_id = target_up.id
  LEFT JOIN public.grant_comments gc ON mn.grant_comment_id = gc.id
  LEFT JOIN public.task_comments tc ON mn.task_comment_id = tc.id
  LEFT JOIN public.grant_tasks gt ON tc.task_id = gt.id
  WHERE mn.dismissed = FALSE
  ';

  RAISE NOTICE 'Updating get_comment_thread function with correct user_profiles schema...';

  -- =====================================================
  -- 2. FIX GET_COMMENT_THREAD FUNCTION
  -- =====================================================
  EXECUTE '
  CREATE OR REPLACE FUNCTION get_comment_thread(
    p_thread_id UUID,
    p_table_name TEXT DEFAULT ''grant_comments''
  )
  RETURNS TABLE (
    id UUID,
    parent_comment_id UUID,
    user_id UUID,
    content TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_edited BOOLEAN,
    user_name TEXT,
    user_email TEXT,
    level INTEGER
  ) AS $func$
  BEGIN
    IF p_table_name = ''grant_comments'' THEN
      RETURN QUERY
      WITH RECURSIVE thread AS (
        -- Root comment
        SELECT
          gc.id,
          gc.parent_comment_id,
          gc.user_id,
          gc.content,
          gc.created_at,
          gc.updated_at,
          gc.is_edited,
          COALESCE(up.full_name, u.email) AS user_name,
          u.email AS user_email,
          0 AS level
        FROM public.grant_comments gc
        JOIN auth.users u ON gc.user_id = u.id
        LEFT JOIN public.user_profiles up ON gc.user_id = up.id
        WHERE gc.thread_id = p_thread_id
          AND gc.parent_comment_id IS NULL
          AND gc.is_deleted = FALSE

        UNION ALL

        -- Replies
        SELECT
          gc.id,
          gc.parent_comment_id,
          gc.user_id,
          gc.content,
          gc.created_at,
          gc.updated_at,
          gc.is_edited,
          COALESCE(up.full_name, u.email) AS user_name,
          u.email AS user_email,
          t.level + 1
        FROM public.grant_comments gc
        JOIN thread t ON gc.parent_comment_id = t.id
        JOIN auth.users u ON gc.user_id = u.id
        LEFT JOIN public.user_profiles up ON gc.user_id = up.id
        WHERE gc.is_deleted = FALSE
      )
      SELECT * FROM thread ORDER BY created_at ASC;

    ELSIF p_table_name = ''task_comments'' THEN
      RETURN QUERY
      WITH RECURSIVE thread AS (
        SELECT
          tc.id,
          tc.parent_comment_id,
          tc.user_id,
          tc.content,
          tc.created_at,
          tc.updated_at,
          tc.is_edited,
          COALESCE(up.full_name, u.email) AS user_name,
          u.email AS user_email,
          0 AS level
        FROM public.task_comments tc
        JOIN auth.users u ON tc.user_id = u.id
        LEFT JOIN public.user_profiles up ON tc.user_id = up.id
        WHERE tc.thread_id = p_thread_id
          AND tc.parent_comment_id IS NULL
          AND tc.is_deleted = FALSE

        UNION ALL

        SELECT
          tc.id,
          tc.parent_comment_id,
          tc.user_id,
          tc.content,
          tc.created_at,
          tc.updated_at,
          tc.is_edited,
          COALESCE(up.full_name, u.email) AS user_name,
          u.email AS user_email,
          t.level + 1
        FROM public.task_comments tc
        JOIN thread t ON tc.parent_comment_id = t.id
        JOIN auth.users u ON tc.user_id = u.id
        LEFT JOIN public.user_profiles up ON tc.user_id = up.id
        WHERE tc.is_deleted = FALSE
      )
      SELECT * FROM thread ORDER BY created_at ASC;
    END IF;
  END;
  $func$ LANGUAGE plpgsql
  ';

  RAISE NOTICE 'Collaboration features schema fix completed successfully!';

END $$;
