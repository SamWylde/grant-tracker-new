-- =====================================================
-- Personal Data Export System (GDPR Compliance)
-- Created: 2025-02-11
-- Purpose: Enable users to request and download complete
--          personal data exports for GDPR compliance
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. DATA EXPORT REQUESTS TABLE
-- Tracks user requests for personal data exports
-- =====================================================
CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Export configuration
  format TEXT NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'csv', 'both')),
  include_deleted BOOLEAN DEFAULT FALSE,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),

  -- File information (populated when completed)
  export_file_path TEXT, -- Path to the export file in storage
  export_file_size BIGINT, -- Size in bytes
  download_token UUID DEFAULT uuid_generate_v4(), -- Secure token for download
  download_count INTEGER DEFAULT 0,

  -- Progress tracking
  progress_percentage INTEGER DEFAULT 0,
  current_step TEXT,
  error_message TEXT,

  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Download link expiration (7 days from completion)
  downloaded_at TIMESTAMPTZ,

  -- Metadata
  user_agent TEXT,
  ip_address TEXT,

  -- Constraints
  CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_data_export_requests_user_id ON public.data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_status ON public.data_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_download_token ON public.data_export_requests(download_token) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_data_export_requests_created ON public.data_export_requests(requested_at DESC);

-- Comments
COMMENT ON TABLE public.data_export_requests IS 'Tracks personal data export requests for GDPR compliance';
COMMENT ON COLUMN public.data_export_requests.download_token IS 'Secure UUID token for authenticated download access';
COMMENT ON COLUMN public.data_export_requests.expires_at IS 'Download link expiration timestamp (typically 7 days from completion)';

-- =====================================================
-- 2. EXPORT AUDIT LOG TABLE
-- Tracks all export-related activities for compliance
-- =====================================================
CREATE TABLE IF NOT EXISTS public.data_export_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  export_request_id UUID NOT NULL REFERENCES public.data_export_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Activity details
  action TEXT NOT NULL CHECK (action IN (
    'requested', 'started', 'completed', 'failed', 'downloaded',
    'expired', 'deleted', 'regenerated'
  )),

  -- Context
  details JSONB,
  user_agent TEXT,
  ip_address TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_export_audit_log_export ON public.data_export_audit_log(export_request_id);
CREATE INDEX IF NOT EXISTS idx_data_export_audit_log_user ON public.data_export_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_audit_log_created ON public.data_export_audit_log(created_at DESC);

-- Comments
COMMENT ON TABLE public.data_export_audit_log IS 'Audit trail for all personal data export activities';

-- =====================================================
-- 3. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update export status and set expiration
CREATE OR REPLACE FUNCTION update_export_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- When export is completed, set expiration to 7 days from now
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
    NEW.expires_at = NOW() + INTERVAL '7 days';
    NEW.progress_percentage = 100;
  END IF;

  -- When export is started
  IF NEW.status = 'processing' AND OLD.status = 'pending' THEN
    NEW.started_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for export completion
DROP TRIGGER IF EXISTS on_export_status_change ON public.data_export_requests;
CREATE TRIGGER on_export_status_change
  BEFORE UPDATE ON public.data_export_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_export_completion();

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION log_export_activity()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  details_json JSONB;
BEGIN
  -- Determine action type based on operation and status
  IF TG_OP = 'INSERT' THEN
    action_type = 'requested';
    details_json = jsonb_build_object(
      'format', NEW.format,
      'include_deleted', NEW.include_deleted
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'processing' AND OLD.status = 'pending' THEN
      action_type = 'started';
    ELSIF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      action_type = 'completed';
      details_json = jsonb_build_object(
        'file_size', NEW.export_file_size,
        'format', NEW.format
      );
    ELSIF NEW.status = 'failed' AND OLD.status != 'failed' THEN
      action_type = 'failed';
      details_json = jsonb_build_object(
        'error', NEW.error_message
      );
    ELSIF NEW.status = 'expired' AND OLD.status != 'expired' THEN
      action_type = 'expired';
    ELSIF NEW.download_count > OLD.download_count THEN
      action_type = 'downloaded';
      details_json = jsonb_build_object(
        'download_count', NEW.download_count
      );
    ELSE
      -- No audit log for other updates
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    action_type = 'deleted';
  END IF;

  -- Insert audit log entry
  INSERT INTO public.data_export_audit_log (
    export_request_id,
    user_id,
    action,
    details,
    user_agent,
    ip_address
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.user_id, OLD.user_id),
    action_type,
    details_json,
    COALESCE(NEW.user_agent, OLD.user_agent),
    COALESCE(NEW.ip_address, OLD.ip_address)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for audit logging
DROP TRIGGER IF EXISTS on_export_activity ON public.data_export_requests;
CREATE TRIGGER on_export_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.data_export_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_export_activity();

-- Function to clean up expired exports (for cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS TABLE(deleted_count INTEGER, bytes_freed BIGINT) AS $$
DECLARE
  total_deleted INTEGER := 0;
  total_bytes BIGINT := 0;
BEGIN
  -- Get stats before deletion
  SELECT COUNT(*), COALESCE(SUM(export_file_size), 0)
  INTO total_deleted, total_bytes
  FROM public.data_export_requests
  WHERE status = 'completed'
    AND expires_at < NOW();

  -- Mark expired exports
  UPDATE public.data_export_requests
  SET status = 'expired'
  WHERE status = 'completed'
    AND expires_at < NOW();

  -- Return cleanup stats
  RETURN QUERY SELECT total_deleted, total_bytes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_expired_exports() TO authenticated;

COMMENT ON FUNCTION cleanup_expired_exports IS 'Marks expired export requests and returns cleanup statistics';

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_audit_log ENABLE ROW LEVEL SECURITY;

-- Data Export Requests Policies
-- Users can view their own export requests
DROP POLICY IF EXISTS "Users can view own export requests" ON public.data_export_requests;
CREATE POLICY "Users can view own export requests"
  ON public.data_export_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own export requests
DROP POLICY IF EXISTS "Users can create export requests" ON public.data_export_requests;
CREATE POLICY "Users can create export requests"
  ON public.data_export_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own export requests (for download tracking)
DROP POLICY IF EXISTS "Users can update own export requests" ON public.data_export_requests;
CREATE POLICY "Users can update own export requests"
  ON public.data_export_requests
  FOR UPDATE
  USING (user_id = auth.uid());

-- Service role can manage all exports (for background processing)
DROP POLICY IF EXISTS "Service role can manage exports" ON public.data_export_requests;
CREATE POLICY "Service role can manage exports"
  ON public.data_export_requests
  FOR ALL
  USING (auth.role() = 'service_role');

-- Data Export Audit Log Policies
-- Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view own export audit logs" ON public.data_export_audit_log;
CREATE POLICY "Users can view own export audit logs"
  ON public.data_export_audit_log
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role can manage all audit logs
DROP POLICY IF EXISTS "Service role can manage audit logs" ON public.data_export_audit_log;
CREATE POLICY "Service role can manage audit logs"
  ON public.data_export_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 5. HELPER VIEWS
-- =====================================================

-- View for active (non-expired) export requests
CREATE OR REPLACE VIEW public.active_export_requests AS
SELECT
  id,
  user_id,
  format,
  status,
  export_file_size,
  download_token,
  download_count,
  progress_percentage,
  current_step,
  requested_at,
  completed_at,
  expires_at,
  (expires_at - NOW()) AS time_remaining
FROM public.data_export_requests
WHERE status IN ('pending', 'processing', 'completed')
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY requested_at DESC;

COMMENT ON VIEW public.active_export_requests IS 'Active export requests that have not expired';

-- =====================================================
-- 6. INITIAL DATA / CONFIGURATION
-- =====================================================

-- No initial data needed for export system
