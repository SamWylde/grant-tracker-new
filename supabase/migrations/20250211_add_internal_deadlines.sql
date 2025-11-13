-- =====================================================
-- ADD INTERNAL DEADLINE FIELDS
-- =====================================================
-- Add internal deadline tracking for grants and tasks
-- Internal deadlines are team-defined deadlines that may be earlier
-- than external deadlines to allow buffer time for reviews and revisions

-- =====================================================
-- 1. Add internal_deadline to org_grants_saved
-- =====================================================

-- Add internal_deadline column for grants
ALTER TABLE public.org_grants_saved
  ADD COLUMN IF NOT EXISTS internal_deadline TIMESTAMPTZ;

-- Add index for faster querying by internal deadline
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_internal_deadline
  ON public.org_grants_saved(internal_deadline)
  WHERE internal_deadline IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.org_grants_saved.internal_deadline IS 'Internal team deadline - often set earlier than external deadlines to allow time for review and revisions';

-- =====================================================
-- 2. Add internal_deadline to grant_tasks
-- =====================================================

-- Add internal_deadline column for tasks (separate from due_date)
ALTER TABLE public.grant_tasks
  ADD COLUMN IF NOT EXISTS internal_deadline TIMESTAMPTZ;

-- Add index for faster querying by internal deadline
CREATE INDEX IF NOT EXISTS idx_grant_tasks_internal_deadline
  ON public.grant_tasks(internal_deadline)
  WHERE internal_deadline IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.grant_tasks.internal_deadline IS 'Internal team deadline for this task - typically earlier than due_date to allow buffer time';

-- =====================================================
-- 3. Update organization settings for new reminder types
-- =====================================================

-- Add settings for LOI deadline reminders
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS loi_deadline_reminders_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS loi_deadline_reminders_30d BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS loi_deadline_reminders_14d BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS loi_deadline_reminders_7d BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS loi_deadline_reminders_3d BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS loi_deadline_reminders_1d BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS loi_deadline_reminders_0d BOOLEAN DEFAULT TRUE;

-- Add settings for internal deadline reminders
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS internal_deadline_reminders_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS internal_deadline_reminders_30d BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS internal_deadline_reminders_14d BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS internal_deadline_reminders_7d BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS internal_deadline_reminders_3d BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS internal_deadline_reminders_1d BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS internal_deadline_reminders_0d BOOLEAN DEFAULT TRUE;

-- Add comments for new settings
COMMENT ON COLUMN public.organization_settings.loi_deadline_reminders_enabled IS 'Enable/disable all LOI deadline reminder emails';
COMMENT ON COLUMN public.organization_settings.internal_deadline_reminders_enabled IS 'Enable/disable all internal deadline reminder emails';

-- =====================================================
-- 4. Create view for all upcoming deadlines
-- =====================================================

-- Create a unified view of all deadlines (external, LOI, and internal)
CREATE OR REPLACE VIEW public.upcoming_deadlines AS
SELECT
  g.id,
  g.org_id,
  g.title,
  g.agency,
  g.status,
  g.priority,
  g.assigned_to,
  'external' AS deadline_type,
  g.close_date AS deadline,
  EXTRACT(DAY FROM (g.close_date - NOW())) AS days_until
FROM public.org_grants_saved g
WHERE g.close_date IS NOT NULL
  AND g.close_date > NOW()
  AND g.status NOT IN ('awarded', 'rejected', 'withdrawn')

UNION ALL

SELECT
  g.id,
  g.org_id,
  g.title,
  g.agency,
  g.status,
  g.priority,
  g.assigned_to,
  'loi' AS deadline_type,
  g.loi_deadline AS deadline,
  EXTRACT(DAY FROM (g.loi_deadline - NOW())) AS days_until
FROM public.org_grants_saved g
WHERE g.loi_deadline IS NOT NULL
  AND g.loi_deadline > NOW()
  AND g.status NOT IN ('awarded', 'rejected', 'withdrawn')

UNION ALL

SELECT
  g.id,
  g.org_id,
  g.title,
  g.agency,
  g.status,
  g.priority,
  g.assigned_to,
  'internal' AS deadline_type,
  g.internal_deadline AS deadline,
  EXTRACT(DAY FROM (g.internal_deadline - NOW())) AS days_until
FROM public.org_grants_saved g
WHERE g.internal_deadline IS NOT NULL
  AND g.internal_deadline > NOW()
  AND g.status NOT IN ('awarded', 'rejected', 'withdrawn')

ORDER BY deadline ASC;

-- Grant select permission on the view
GRANT SELECT ON public.upcoming_deadlines TO authenticated;

COMMENT ON VIEW public.upcoming_deadlines IS 'Unified view of all upcoming grant deadlines (external, LOI, and internal)';

-- =====================================================
-- 5. Create function to get deadlines for a specific time range
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_deadlines_for_date_range(
  p_org_id UUID,
  p_deadline_type TEXT,
  p_days_until INTEGER
)
RETURNS TABLE (
  grant_id UUID,
  grant_title TEXT,
  grant_agency TEXT,
  deadline TIMESTAMPTZ,
  deadline_type TEXT,
  status TEXT,
  priority TEXT,
  assigned_to UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ud.id AS grant_id,
    ud.title AS grant_title,
    ud.agency AS grant_agency,
    ud.deadline,
    ud.deadline_type,
    ud.status,
    ud.priority,
    ud.assigned_to
  FROM public.upcoming_deadlines ud
  WHERE ud.org_id = p_org_id
    AND (p_deadline_type = 'all' OR ud.deadline_type = p_deadline_type)
    AND ud.days_until >= p_days_until
    AND ud.days_until < p_days_until + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_deadlines_for_date_range(UUID, TEXT, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_deadlines_for_date_range IS 'Get all deadlines for an organization within a specific time range';
