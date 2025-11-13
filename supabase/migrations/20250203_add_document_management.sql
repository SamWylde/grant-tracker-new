-- Document Management System
-- Phase 1: Core document storage with version control and plan-based limits
--
-- Features:
-- - Document uploads with metadata
-- - Version control and history tracking
-- - Plan-based storage quotas (free: 50MB, starter: 250MB, pro: 5GB, enterprise: 25GB)
-- - Support for multiple storage providers (Supabase, Google Drive, OneDrive, Dropbox)
-- - Document categorization and organization
-- - Change history and audit logs

-- Document storage table
CREATE TABLE IF NOT EXISTS public.grant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grant_id UUID REFERENCES public.org_grants_saved(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.grant_tasks(id) ON DELETE CASCADE,

  -- File metadata
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- MIME type
  file_size BIGINT NOT NULL, -- bytes
  storage_url TEXT NOT NULL, -- Supabase Storage path or external URL
  storage_provider TEXT NOT NULL DEFAULT 'supabase', -- 'supabase', 'google_drive', 'onedrive', 'dropbox'

  -- Version control
  version INTEGER NOT NULL DEFAULT 1,
  parent_document_id UUID REFERENCES public.grant_documents(id) ON DELETE SET NULL,
  is_latest_version BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  description TEXT,
  document_category TEXT CHECK (document_category IN ('budget', 'narrative', 'letters', 'financial', 'supporting', 'other')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete

  CONSTRAINT valid_parent CHECK (parent_document_id IS NULL OR parent_document_id != id),
  CONSTRAINT valid_file_size CHECK (file_size > 0)
);

-- Document change history
CREATE TABLE IF NOT EXISTS public.grant_document_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.grant_documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('uploaded', 'updated', 'deleted', 'restored', 'downloaded', 'shared')),
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changes JSONB, -- Details about what changed
  ip_address TEXT, -- For audit purposes
  user_agent TEXT, -- For audit purposes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document storage quotas by plan
CREATE TABLE IF NOT EXISTS public.organization_storage_quotas (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Current usage
  total_storage_bytes BIGINT NOT NULL DEFAULT 0,
  total_documents INTEGER NOT NULL DEFAULT 0,

  -- Limits (NULL means unlimited)
  max_storage_bytes BIGINT, -- Plan-based limit
  max_documents INTEGER, -- Plan-based limit
  max_file_size_bytes BIGINT, -- Plan-based limit per file

  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_usage CHECK (total_storage_bytes >= 0 AND total_documents >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_org ON public.grant_documents(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_grant ON public.grant_documents(grant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_task ON public.grant_documents(task_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.grant_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_latest ON public.grant_documents(org_id, is_latest_version) WHERE deleted_at IS NULL AND is_latest_version = true;
CREATE INDEX IF NOT EXISTS idx_documents_parent ON public.grant_documents(parent_document_id) WHERE parent_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_history_doc ON public.grant_document_history(document_id);
CREATE INDEX IF NOT EXISTS idx_document_history_user ON public.grant_document_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_document_history_created ON public.grant_document_history(created_at DESC);

-- Function to update document version flags
CREATE OR REPLACE FUNCTION public.update_document_version_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a new version of an existing document
  IF NEW.parent_document_id IS NOT NULL THEN
    -- Mark all previous versions as not latest
    UPDATE public.grant_documents
    SET is_latest_version = false
    WHERE id = NEW.parent_document_id
      OR parent_document_id = NEW.parent_document_id;

    -- Ensure the new version is marked as latest
    NEW.is_latest_version = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update storage quotas
CREATE OR REPLACE FUNCTION public.update_storage_quota()
RETURNS TRIGGER AS $$
DECLARE
  size_delta BIGINT;
BEGIN
  -- Calculate size change
  IF TG_OP = 'INSERT' THEN
    size_delta = NEW.file_size;
  ELSIF TG_OP = 'UPDATE' THEN
    size_delta = NEW.file_size - OLD.file_size;
  ELSIF TG_OP = 'DELETE' THEN
    size_delta = -OLD.file_size;
  END IF;

  -- Update quota for the organization
  INSERT INTO public.organization_storage_quotas (org_id, total_storage_bytes, total_documents, updated_at)
  VALUES (
    COALESCE(NEW.org_id, OLD.org_id),
    GREATEST(0, size_delta),
    CASE WHEN TG_OP = 'DELETE' THEN 0 ELSE 1 END,
    NOW()
  )
  ON CONFLICT (org_id) DO UPDATE SET
    total_storage_bytes = GREATEST(0, organization_storage_quotas.total_storage_bytes + size_delta),
    total_documents = CASE
      WHEN TG_OP = 'INSERT' THEN organization_storage_quotas.total_documents + 1
      WHEN TG_OP = 'DELETE' THEN GREATEST(0, organization_storage_quotas.total_documents - 1)
      ELSE organization_storage_quotas.total_documents
    END,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check quota before upload
CREATE OR REPLACE FUNCTION public.check_document_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_quota RECORD;
  plan_limits RECORD;
BEGIN
  -- Get current quota
  SELECT * INTO current_quota
  FROM public.organization_storage_quotas
  WHERE org_id = NEW.org_id;

  -- Get plan limits from organization settings
  SELECT
    CASE
      WHEN os.plan_name = 'free' THEN 52428800 -- 50MB
      WHEN os.plan_name = 'starter' THEN 262144000 -- 250MB
      WHEN os.plan_name = 'pro' THEN 5368709120 -- 5GB
      WHEN os.plan_name = 'enterprise' THEN 26843545600 -- 25GB
      ELSE 52428800 -- Default to free tier
    END as max_storage_bytes,
    CASE
      WHEN os.plan_name = 'free' THEN 10
      WHEN os.plan_name = 'starter' THEN 50
      ELSE NULL -- Unlimited for pro/enterprise
    END as max_documents,
    CASE
      WHEN os.plan_name = 'free' THEN 5242880 -- 5MB
      WHEN os.plan_name = 'starter' THEN 10485760 -- 10MB
      WHEN os.plan_name = 'pro' THEN 52428800 -- 50MB
      WHEN os.plan_name = 'enterprise' THEN 104857600 -- 100MB
      ELSE 5242880 -- Default to free tier
    END as max_file_size_bytes
  INTO plan_limits
  FROM public.organization_settings os
  WHERE os.org_id = NEW.org_id;

  -- Check file size limit
  IF NEW.file_size > plan_limits.max_file_size_bytes THEN
    RAISE EXCEPTION 'File size exceeds plan limit of % bytes', plan_limits.max_file_size_bytes;
  END IF;

  -- Check total storage limit
  IF current_quota.total_storage_bytes + NEW.file_size > plan_limits.max_storage_bytes THEN
    RAISE EXCEPTION 'Storage quota exceeded. Current: % bytes, Limit: % bytes',
      current_quota.total_storage_bytes, plan_limits.max_storage_bytes;
  END IF;

  -- Check document count limit (if applicable)
  IF plan_limits.max_documents IS NOT NULL AND
     current_quota.total_documents >= plan_limits.max_documents THEN
    RAISE EXCEPTION 'Document count limit exceeded. Limit: %', plan_limits.max_documents;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log document actions
CREATE OR REPLACE FUNCTION public.log_document_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  change_data JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type = 'uploaded';
    change_data = jsonb_build_object(
      'file_name', NEW.file_name,
      'file_size', NEW.file_size,
      'file_type', NEW.file_type
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      action_type = 'deleted';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      action_type = 'restored';
    ELSE
      action_type = 'updated';
    END IF;
    change_data = jsonb_build_object(
      'old', row_to_json(OLD)::jsonb,
      'new', row_to_json(NEW)::jsonb
    );
  ELSIF TG_OP = 'DELETE' THEN
    action_type = 'deleted';
    change_data = jsonb_build_object(
      'file_name', OLD.file_name,
      'file_size', OLD.file_size
    );
  END IF;

  -- Insert history record
  INSERT INTO public.grant_document_history (
    document_id,
    action,
    changed_by,
    changes,
    created_at
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    action_type,
    COALESCE(NEW.uploaded_by, OLD.uploaded_by),
    change_data,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE TRIGGER trigger_update_document_version_flags
  BEFORE INSERT ON public.grant_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_document_version_flags();

CREATE TRIGGER trigger_check_document_quota
  BEFORE INSERT ON public.grant_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.check_document_quota();

CREATE TRIGGER trigger_update_storage_quota_insert
  AFTER INSERT ON public.grant_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_storage_quota();

CREATE TRIGGER trigger_update_storage_quota_delete
  AFTER DELETE ON public.grant_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_storage_quota();

CREATE TRIGGER trigger_log_document_action
  AFTER INSERT OR UPDATE OR DELETE ON public.grant_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.log_document_action();

-- Update timestamp trigger
CREATE TRIGGER trigger_update_grant_documents_timestamp
  BEFORE UPDATE ON public.grant_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Initialize storage quotas for existing organizations
INSERT INTO public.organization_storage_quotas (org_id, total_storage_bytes, total_documents, updated_at)
SELECT
  o.id,
  0,
  0,
  NOW()
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_storage_quotas q WHERE q.org_id = o.id
);

-- Row Level Security (RLS)
ALTER TABLE public.grant_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_document_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_storage_quotas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for grant_documents
CREATE POLICY "Users can view documents in their organization"
  ON public.grant_documents
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can upload documents to their organization"
  ON public.grant_documents
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Users can update their own documents"
  ON public.grant_documents
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
    )
    AND (uploaded_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = grant_documents.org_id
        AND om.role = 'admin'
    ))
  );

CREATE POLICY "Users can delete their own documents or admins can delete any"
  ON public.grant_documents
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
    )
    AND (uploaded_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = grant_documents.org_id
        AND om.role = 'admin'
    ))
  );

-- RLS Policies for grant_document_history
CREATE POLICY "Users can view document history in their organization"
  ON public.grant_document_history
  FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM public.grant_documents
      WHERE org_id IN (
        SELECT org_id FROM public.org_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for organization_storage_quotas
CREATE POLICY "Users can view their organization's quota"
  ON public.organization_storage_quotas
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE public.grant_documents IS 'Stores documents attached to grants and tasks with version control';
COMMENT ON TABLE public.grant_document_history IS 'Audit log for all document operations';
COMMENT ON TABLE public.organization_storage_quotas IS 'Tracks storage usage and enforces plan-based limits';
COMMENT ON COLUMN public.grant_documents.storage_provider IS 'Storage provider: supabase (default), google_drive, onedrive, dropbox';
COMMENT ON COLUMN public.grant_documents.is_latest_version IS 'Indicates if this is the most recent version of the document';
COMMENT ON COLUMN public.grant_documents.parent_document_id IS 'Links to the previous version for version control';
