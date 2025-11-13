-- =====================================================
-- Scheduled Email Reports Migration
-- Created: 2025-02-06
-- Purpose: Add scheduled email reports feature for weekly/monthly
--          digests and summaries
-- =====================================================

-- =====================================================
-- 1. SCHEDULED REPORTS TABLE
-- Stores report preferences for users and organizations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL means org-wide report

  -- Report configuration
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly_digest', 'monthly_summary')),
  enabled BOOLEAN DEFAULT TRUE,

  -- Report settings for weekly_digest
  include_new_matches BOOLEAN DEFAULT TRUE,      -- New grants matching profile
  include_upcoming_deadlines BOOLEAN DEFAULT TRUE, -- Grants with upcoming deadlines
  include_team_activity BOOLEAN DEFAULT TRUE,     -- Team activity summary

  -- Report settings for monthly_summary
  include_submissions BOOLEAN DEFAULT TRUE,       -- Submission statistics
  include_awards BOOLEAN DEFAULT TRUE,            -- Award statistics
  include_pipeline_health BOOLEAN DEFAULT TRUE,   -- Pipeline health metrics

  -- Delivery preferences
  delivery_day INTEGER, -- 0 = Sunday, 1 = Monday, etc. (for weekly)
  delivery_time TIME DEFAULT '09:00:00', -- Time of day to send (org timezone)
  delivery_timezone TEXT DEFAULT 'America/New_York',

  -- Custom template (JSON)
  custom_template JSONB, -- Custom email template configuration
  custom_sections JSONB, -- Additional custom sections to include

  -- Tracking
  last_sent_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  UNIQUE(org_id, user_id, report_type),
  CHECK (
    (report_type = 'weekly_digest' AND delivery_day IS NOT NULL) OR
    (report_type = 'monthly_summary' AND delivery_day IS NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_org ON public.scheduled_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user ON public.scheduled_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_enabled ON public.scheduled_reports(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_scheduled ON public.scheduled_reports(next_scheduled_at) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON public.scheduled_reports(report_type);

-- Comments
COMMENT ON TABLE public.scheduled_reports IS 'Scheduled email report preferences for users and organizations';
COMMENT ON COLUMN public.scheduled_reports.user_id IS 'NULL means org-wide report sent to all members';
COMMENT ON COLUMN public.scheduled_reports.delivery_day IS '0=Sunday, 1=Monday, etc. Required for weekly reports';
COMMENT ON COLUMN public.scheduled_reports.custom_template IS 'Custom email template configuration in JSON format';
COMMENT ON COLUMN public.scheduled_reports.next_scheduled_at IS 'Calculated timestamp for next scheduled send';

-- =====================================================
-- 2. REPORT DELIVERY LOG TABLE
-- Track report delivery history
-- =====================================================
CREATE TABLE IF NOT EXISTS public.report_delivery_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  scheduled_report_id UUID NOT NULL REFERENCES public.scheduled_reports(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Delivery details
  report_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,

  -- Report content metadata
  grants_included INTEGER,
  deadlines_included INTEGER,
  activities_included INTEGER,

  -- Email provider response
  email_provider_id TEXT, -- ID from Resend or other provider
  recipient_email TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_delivery_log_scheduled_report ON public.report_delivery_log(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_report_delivery_log_org ON public.report_delivery_log(org_id);
CREATE INDEX IF NOT EXISTS idx_report_delivery_log_user ON public.report_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_report_delivery_log_sent_at ON public.report_delivery_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_delivery_log_status ON public.report_delivery_log(status);

-- Comments
COMMENT ON TABLE public.report_delivery_log IS 'Audit log of report email deliveries';
COMMENT ON COLUMN public.report_delivery_log.status IS 'sent=successfully sent, failed=delivery error, skipped=no data to report';

-- =====================================================
-- 3. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
DROP TRIGGER IF EXISTS update_scheduled_reports_updated_at ON public.scheduled_reports;
CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON public.scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate next scheduled time
CREATE OR REPLACE FUNCTION calculate_next_scheduled_at(
  p_report_type TEXT,
  p_delivery_day INTEGER,
  p_delivery_time TIME,
  p_delivery_timezone TEXT,
  p_last_sent_at TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_next_scheduled TIMESTAMPTZ;
  v_now TIMESTAMPTZ;
BEGIN
  v_now := NOW();

  IF p_report_type = 'weekly_digest' THEN
    -- Calculate next occurrence of delivery_day
    v_next_scheduled := date_trunc('week', v_now) +
                        (p_delivery_day || ' days')::INTERVAL +
                        p_delivery_time::INTERVAL;

    -- If that time has already passed this week, schedule for next week
    IF v_next_scheduled <= v_now THEN
      v_next_scheduled := v_next_scheduled + INTERVAL '7 days';
    END IF;

  ELSIF p_report_type = 'monthly_summary' THEN
    -- Schedule for first day of next month
    v_next_scheduled := date_trunc('month', v_now) + INTERVAL '1 month' +
                        p_delivery_time::INTERVAL;

    -- If we're on the first day and haven't sent yet today, send today
    IF date_trunc('month', v_now) = date_trunc('day', v_now) AND
       (p_last_sent_at IS NULL OR p_last_sent_at < date_trunc('month', v_now)) THEN
      v_next_scheduled := date_trunc('day', v_now) + p_delivery_time::INTERVAL;

      -- If time has passed today, schedule for next month
      IF v_next_scheduled <= v_now THEN
        v_next_scheduled := date_trunc('month', v_now) + INTERVAL '1 month' +
                            p_delivery_time::INTERVAL;
      END IF;
    END IF;
  END IF;

  RETURN v_next_scheduled;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-calculate next_scheduled_at on insert/update
CREATE OR REPLACE FUNCTION set_next_scheduled_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.enabled = TRUE THEN
    NEW.next_scheduled_at := calculate_next_scheduled_at(
      NEW.report_type,
      NEW.delivery_day,
      NEW.delivery_time,
      NEW.delivery_timezone,
      NEW.last_sent_at
    );
  ELSE
    NEW.next_scheduled_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set next_scheduled_at
DROP TRIGGER IF EXISTS set_scheduled_report_next_time ON public.scheduled_reports;
CREATE TRIGGER set_scheduled_report_next_time
  BEFORE INSERT OR UPDATE ON public.scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_next_scheduled_at();

-- Function to get reports due for sending
CREATE OR REPLACE FUNCTION get_reports_due_for_sending()
RETURNS TABLE (
  id UUID,
  org_id UUID,
  user_id UUID,
  report_type TEXT,
  org_name TEXT,
  user_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id,
    sr.org_id,
    sr.user_id,
    sr.report_type,
    o.name AS org_name,
    u.email AS user_email
  FROM public.scheduled_reports sr
  JOIN public.organizations o ON sr.org_id = o.id
  LEFT JOIN auth.users u ON sr.user_id = u.id
  WHERE sr.enabled = TRUE
    AND sr.next_scheduled_at IS NOT NULL
    AND sr.next_scheduled_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_delivery_log ENABLE ROW LEVEL SECURITY;

-- Scheduled Reports: Org members can view
DROP POLICY IF EXISTS "Org members can view scheduled reports" ON public.scheduled_reports;
CREATE POLICY "Org members can view scheduled reports"
  ON public.scheduled_reports FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Admins can create org-wide reports
DROP POLICY IF EXISTS "Admins can create org-wide reports" ON public.scheduled_reports;
CREATE POLICY "Admins can create org-wide reports"
  ON public.scheduled_reports FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Users can create their own reports
DROP POLICY IF EXISTS "Users can create own reports" ON public.scheduled_reports;
CREATE POLICY "Users can create own reports"
  ON public.scheduled_reports FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can update org-wide reports
DROP POLICY IF EXISTS "Admins can update org-wide reports" ON public.scheduled_reports;
CREATE POLICY "Admins can update org-wide reports"
  ON public.scheduled_reports FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Users can update their own reports
DROP POLICY IF EXISTS "Users can update own reports" ON public.scheduled_reports;
CREATE POLICY "Users can update own reports"
  ON public.scheduled_reports FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can delete org-wide reports
DROP POLICY IF EXISTS "Admins can delete org-wide reports" ON public.scheduled_reports;
CREATE POLICY "Admins can delete org-wide reports"
  ON public.scheduled_reports FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Users can delete their own reports
DROP POLICY IF EXISTS "Users can delete own reports" ON public.scheduled_reports;
CREATE POLICY "Users can delete own reports"
  ON public.scheduled_reports FOR DELETE
  USING (user_id = auth.uid());

-- Service role can manage all reports (for cron job)
DROP POLICY IF EXISTS "Service role can manage all reports" ON public.scheduled_reports;
CREATE POLICY "Service role can manage all reports"
  ON public.scheduled_reports FOR ALL
  USING (auth.role() = 'service_role');

-- Report Delivery Log: Org members can view their logs
DROP POLICY IF EXISTS "Org members can view delivery logs" ON public.report_delivery_log;
CREATE POLICY "Org members can view delivery logs"
  ON public.report_delivery_log FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Service role can insert logs
DROP POLICY IF EXISTS "Service role can insert logs" ON public.report_delivery_log;
CREATE POLICY "Service role can insert logs"
  ON public.report_delivery_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 5. DEFAULT REPORT CONFIGURATIONS
-- =====================================================

-- Function to create default reports for an organization
CREATE OR REPLACE FUNCTION create_default_reports_for_org(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Create default weekly digest (org-wide)
  INSERT INTO public.scheduled_reports (
    org_id,
    user_id,
    report_type,
    enabled,
    include_new_matches,
    include_upcoming_deadlines,
    include_team_activity,
    delivery_day,
    delivery_time,
    delivery_timezone
  )
  VALUES (
    p_org_id,
    NULL, -- org-wide
    'weekly_digest',
    FALSE, -- disabled by default, user can enable
    TRUE,
    TRUE,
    TRUE,
    1, -- Monday
    '09:00:00',
    'America/New_York'
  )
  ON CONFLICT (org_id, user_id, report_type) DO NOTHING;

  -- Create default monthly summary (org-wide)
  INSERT INTO public.scheduled_reports (
    org_id,
    user_id,
    report_type,
    enabled,
    include_submissions,
    include_awards,
    include_pipeline_health,
    delivery_time,
    delivery_timezone
  )
  VALUES (
    p_org_id,
    NULL, -- org-wide
    'monthly_summary',
    FALSE, -- disabled by default, user can enable
    TRUE,
    TRUE,
    TRUE,
    '09:00:00',
    'America/New_York'
  )
  ON CONFLICT (org_id, user_id, report_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. BACKFILL DEFAULT REPORTS FOR EXISTING ORGS
-- =====================================================

-- Create default reports for all existing organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM public.organizations LOOP
    PERFORM create_default_reports_for_org(org_record.id);
  END LOOP;
END $$;

-- =====================================================
-- 7. TRIGGER TO CREATE DEFAULT REPORTS ON ORG CREATION
-- =====================================================

-- Modify existing org creation trigger to also create default reports
CREATE OR REPLACE FUNCTION handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  -- Create organization settings (existing functionality)
  INSERT INTO public.organization_settings (org_id)
  VALUES (NEW.id);

  -- Create default report configurations
  PERFORM create_default_reports_for_org(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Trigger already exists, will use updated function
