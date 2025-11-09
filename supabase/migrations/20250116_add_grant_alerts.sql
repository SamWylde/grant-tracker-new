-- Migration: Add Grant Alerts System
-- Description: Allows users to create alerts for new grants matching specific criteria

-- ============================================================================
-- Grant Alerts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS grant_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert configuration
  name TEXT NOT NULL,
  description TEXT,

  -- Search criteria (same as saved views)
  keyword TEXT,
  category TEXT,
  agency TEXT,
  status_posted BOOLEAN DEFAULT true,
  status_forecasted BOOLEAN DEFAULT true,
  due_in_days INTEGER,
  min_amount NUMERIC(12,2),
  max_amount NUMERIC(12,2),

  -- Alert settings
  is_active BOOLEAN DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('realtime', 'daily', 'weekly')),

  -- Notification channels
  notify_email BOOLEAN DEFAULT true,
  notify_in_app BOOLEAN DEFAULT true,
  notify_webhook BOOLEAN DEFAULT false,
  webhook_url TEXT,

  -- Tracking
  last_checked_at TIMESTAMPTZ,
  last_alert_sent_at TIMESTAMPTZ,
  alert_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grant_alerts_org_id ON grant_alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_alerts_user_id ON grant_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_grant_alerts_is_active ON grant_alerts(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE grant_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view alerts in their organization
CREATE POLICY grant_alerts_select ON grant_alerts
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert alerts in their organization
CREATE POLICY grant_alerts_insert ON grant_alerts
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Users can update their own alerts
CREATE POLICY grant_alerts_update ON grant_alerts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own alerts
CREATE POLICY grant_alerts_delete ON grant_alerts
  FOR DELETE
  USING (user_id = auth.uid());

-- Comments
COMMENT ON TABLE grant_alerts IS 'User-created alerts for new grants matching specific criteria';
COMMENT ON COLUMN grant_alerts.frequency IS 'How often to check for new grants: realtime, daily, weekly';
COMMENT ON COLUMN grant_alerts.last_checked_at IS 'Last time the alert was checked for new grants';
COMMENT ON COLUMN grant_alerts.last_alert_sent_at IS 'Last time a notification was sent';
COMMENT ON COLUMN grant_alerts.alert_count IS 'Total number of alerts sent';

-- ============================================================================
-- Grant Alert Matches Table (to track which grants triggered alerts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS grant_alert_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES grant_alerts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Grant information
  external_source TEXT DEFAULT 'grants.gov',
  external_id TEXT NOT NULL,
  grant_title TEXT NOT NULL,
  grant_agency TEXT,
  grant_close_date TIMESTAMPTZ,

  -- Tracking
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grant_alert_matches_alert_id ON grant_alert_matches(alert_id);
CREATE INDEX IF NOT EXISTS idx_grant_alert_matches_org_id ON grant_alert_matches(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_alert_matches_external ON grant_alert_matches(external_source, external_id);
CREATE INDEX IF NOT EXISTS idx_grant_alert_matches_matched_at ON grant_alert_matches(matched_at DESC);

-- Unique constraint to prevent duplicate matches
CREATE UNIQUE INDEX IF NOT EXISTS idx_grant_alert_matches_unique ON grant_alert_matches(alert_id, external_source, external_id);

-- RLS Policies
ALTER TABLE grant_alert_matches ENABLE ROW LEVEL SECURITY;

-- Users can view matches in their organization
CREATE POLICY grant_alert_matches_select ON grant_alert_matches
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Service role can insert matches (for background jobs)
CREATE POLICY grant_alert_matches_insert ON grant_alert_matches
  FOR INSERT
  WITH CHECK (true); -- Background jobs will use service role

-- Users can update matches (mark as viewed/dismissed)
CREATE POLICY grant_alert_matches_update ON grant_alert_matches
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE grant_alert_matches IS 'Tracks which grants matched which alerts and notification status';

-- ============================================================================
-- In-App Notifications Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Notification content
  type TEXT NOT NULL CHECK (type IN ('grant_alert', 'deadline_reminder', 'task_assigned', 'team_update', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Related entities
  related_grant_id TEXT,
  related_task_id UUID,
  related_alert_id UUID REFERENCES grant_alerts(id) ON DELETE SET NULL,

  -- Action link
  action_url TEXT,
  action_label TEXT,

  -- Status
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_id ON in_app_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_org_id ON in_app_notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_created_at ON in_app_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread ON in_app_notifications(user_id, read_at) WHERE read_at IS NULL;

-- RLS Policies
ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY in_app_notifications_select ON in_app_notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role can insert notifications (for background jobs)
CREATE POLICY in_app_notifications_insert ON in_app_notifications
  FOR INSERT
  WITH CHECK (true); -- Background jobs will use service role

-- Users can update their own notifications (mark as read/dismissed)
CREATE POLICY in_app_notifications_update ON in_app_notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY in_app_notifications_delete ON in_app_notifications
  FOR DELETE
  USING (user_id = auth.uid());

-- Comments
COMMENT ON TABLE in_app_notifications IS 'In-app notifications for users';

-- ============================================================================
-- Function to create notification from alert match
-- ============================================================================

CREATE OR REPLACE FUNCTION create_notification_from_alert_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Create in-app notification for all org members who want grant alerts
  INSERT INTO in_app_notifications (user_id, org_id, type, title, message, related_grant_id, related_alert_id, action_url, action_label)
  SELECT
    om.user_id,
    NEW.org_id,
    'grant_alert',
    'New Grant Match: ' || NEW.grant_title,
    'A new grant matching your alert criteria is available.',
    NEW.external_id,
    NEW.alert_id,
    '/discover',
    'View Grant'
  FROM org_members om
  JOIN grant_alerts ga ON ga.id = NEW.alert_id
  WHERE om.org_id = NEW.org_id
    AND ga.notify_in_app = true
    AND ga.is_active = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create notifications
CREATE TRIGGER on_alert_match_create_notification
  AFTER INSERT ON grant_alert_matches
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_from_alert_match();

COMMENT ON FUNCTION create_notification_from_alert_match IS 'Automatically creates in-app notifications when grants match alerts';
