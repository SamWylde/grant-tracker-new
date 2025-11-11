-- Migration: Add Activity Log System
-- Description: Track all changes to grants for audit trail and activity feed

-- ============================================================================
-- Grant Activity Log Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS grant_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Activity details
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted',
    'status_changed', 'priority_changed', 'assigned',
    'note_added', 'note_updated', 'note_deleted',
    'task_added', 'task_completed', 'task_deleted',
    'saved', 'unsaved'
  )),

  -- What changed
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,

  -- Additional context
  metadata JSONB DEFAULT '{}'::jsonb,
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_grant_activity_log_grant_id ON grant_activity_log(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_activity_log_org_id ON grant_activity_log(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_activity_log_user_id ON grant_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_grant_activity_log_created_at ON grant_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grant_activity_log_action ON grant_activity_log(action);

-- RLS Policies
ALTER TABLE grant_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can view activity logs in their organization
CREATE POLICY grant_activity_log_select ON grant_activity_log
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Service role can insert activity logs (for background jobs and triggers)
CREATE POLICY grant_activity_log_insert ON grant_activity_log
  FOR INSERT
  WITH CHECK (true); -- Background jobs and triggers will use service role

-- Comments
COMMENT ON TABLE grant_activity_log IS 'Tracks all changes to grants for audit trail and activity feed';
COMMENT ON COLUMN grant_activity_log.action IS 'Type of activity performed';
COMMENT ON COLUMN grant_activity_log.field_name IS 'Which field was changed (for update actions)';
COMMENT ON COLUMN grant_activity_log.old_value IS 'Previous value before change';
COMMENT ON COLUMN grant_activity_log.new_value IS 'New value after change';
COMMENT ON COLUMN grant_activity_log.metadata IS 'Additional context as JSON (e.g., task details, file info)';

-- ============================================================================
-- Function to log grant status changes
-- ============================================================================

CREATE OR REPLACE FUNCTION log_grant_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO grant_activity_log (
      org_id,
      grant_id,
      user_id,
      action,
      field_name,
      old_value,
      new_value,
      description
    ) VALUES (
      NEW.org_id,
      NEW.id,
      auth.uid(),
      'status_changed',
      'status',
      OLD.status,
      NEW.status,
      'Grant status changed from ' || COALESCE(OLD.status, 'none') || ' to ' || NEW.status
    );
  END IF;

  -- Log priority change
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO grant_activity_log (
      org_id,
      grant_id,
      user_id,
      action,
      field_name,
      old_value,
      new_value,
      description
    ) VALUES (
      NEW.org_id,
      NEW.id,
      auth.uid(),
      'priority_changed',
      'priority',
      OLD.priority,
      NEW.priority,
      'Priority changed from ' || COALESCE(OLD.priority, 'none') || ' to ' || COALESCE(NEW.priority, 'none')
    );
  END IF;

  -- Log assignment change
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO grant_activity_log (
      org_id,
      grant_id,
      user_id,
      action,
      field_name,
      old_value,
      new_value,
      description
    ) VALUES (
      NEW.org_id,
      NEW.id,
      auth.uid(),
      'assigned',
      'assigned_to',
      OLD.assigned_to::text,
      NEW.assigned_to::text,
      'Grant reassigned'
    );
  END IF;

  -- Log notes change
  IF OLD.notes IS DISTINCT FROM NEW.notes THEN
    INSERT INTO grant_activity_log (
      org_id,
      grant_id,
      user_id,
      action,
      field_name,
      old_value,
      new_value,
      description
    ) VALUES (
      NEW.org_id,
      NEW.id,
      auth.uid(),
      CASE
        WHEN OLD.notes IS NULL THEN 'note_added'
        WHEN NEW.notes IS NULL THEN 'note_deleted'
        ELSE 'note_updated'
      END,
      'notes',
      OLD.notes,
      NEW.notes,
      CASE
        WHEN OLD.notes IS NULL THEN 'Note added'
        WHEN NEW.notes IS NULL THEN 'Note deleted'
        ELSE 'Note updated'
      END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log grant changes
DROP TRIGGER IF EXISTS on_grant_update_log_changes ON org_grants_saved;
CREATE TRIGGER on_grant_update_log_changes
  AFTER UPDATE ON org_grants_saved
  FOR EACH ROW
  EXECUTE FUNCTION log_grant_status_change();

-- ============================================================================
-- Function to log grant creation
-- ============================================================================

CREATE OR REPLACE FUNCTION log_grant_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO grant_activity_log (
    org_id,
    grant_id,
    user_id,
    action,
    description
  ) VALUES (
    NEW.org_id,
    NEW.id,
    auth.uid(),
    'saved',
    'Grant added to pipeline'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log grant creation
DROP TRIGGER IF EXISTS on_grant_create_log ON org_grants_saved;
CREATE TRIGGER on_grant_create_log
  AFTER INSERT ON org_grants_saved
  FOR EACH ROW
  EXECUTE FUNCTION log_grant_creation();

COMMENT ON FUNCTION log_grant_status_change IS 'Automatically logs changes to grant status, priority, assignment, and notes';
COMMENT ON FUNCTION log_grant_creation IS 'Automatically logs when a grant is saved to the pipeline';
