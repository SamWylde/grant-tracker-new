-- =====================================================
-- Approval Workflows Migration
-- Created: 2025-02-05
-- Purpose: Implement approval workflow system for grant stage transitions
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. APPROVAL WORKFLOWS TABLE
-- Defines approval requirements for stage transitions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Workflow definition
  name TEXT NOT NULL,
  description TEXT,

  -- Stage transition definition (e.g., "drafting" -> "submitted")
  from_stage TEXT NOT NULL CHECK (from_stage IN ('researching', 'drafting', 'submitted', 'awarded', 'rejected', 'withdrawn')),
  to_stage TEXT NOT NULL CHECK (to_stage IN ('researching', 'drafting', 'submitted', 'awarded', 'rejected', 'withdrawn')),

  -- Approval chain configuration (JSON array of approval levels)
  -- Each level: { level: 1, role: "admin" | "contributor", required_approvers: 1, specific_users: [uuid] }
  approval_chain JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Settings
  is_active BOOLEAN DEFAULT true,
  require_all_levels BOOLEAN DEFAULT true, -- If false, any level approval is sufficient
  allow_self_approval BOOLEAN DEFAULT false,
  auto_approve_admin BOOLEAN DEFAULT false, -- Admins can bypass workflow

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT approval_workflows_different_stages CHECK (from_stage != to_stage),
  CONSTRAINT approval_workflows_unique_transition UNIQUE(org_id, from_stage, to_stage, is_active)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_approval_workflows_org_id ON public.approval_workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_active ON public.approval_workflows(org_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_approval_workflows_transition ON public.approval_workflows(org_id, from_stage, to_stage);

-- Comments
COMMENT ON TABLE public.approval_workflows IS 'Defines approval requirements for grant stage transitions';
COMMENT ON COLUMN public.approval_workflows.approval_chain IS 'JSON array defining multi-level approval requirements';
COMMENT ON COLUMN public.approval_workflows.require_all_levels IS 'If true, all approval levels must approve; if false, any level is sufficient';

-- =====================================================
-- 2. APPROVAL REQUESTS TABLE
-- Individual approval requests for specific grant transitions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES public.org_grants_saved(id) ON DELETE CASCADE,

  -- Request details
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,

  -- Approval status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  current_approval_level INTEGER DEFAULT 1,

  -- Approvals tracking (JSON array of approvals)
  -- Each approval: { level: 1, user_id: uuid, decision: "approved" | "rejected", comment: text, timestamp: iso8601 }
  approvals JSONB DEFAULT '[]'::jsonb,

  -- Request metadata
  request_notes TEXT,
  rejection_reason TEXT,

  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT approval_requests_valid_stages CHECK (from_stage != to_stage)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_approval_requests_org_id ON public.approval_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_grant_id ON public.approval_requests(grant_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_workflow_id ON public.approval_requests(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by ON public.approval_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending ON public.approval_requests(org_id, status, expires_at) WHERE status = 'pending';

-- Comments
COMMENT ON TABLE public.approval_requests IS 'Individual approval requests for grant stage transitions';
COMMENT ON COLUMN public.approval_requests.approvals IS 'JSON array tracking all approval decisions at each level';
COMMENT ON COLUMN public.approval_requests.current_approval_level IS 'Current level in the approval chain (1-indexed)';

-- =====================================================
-- 3. APPROVAL REQUEST APPROVERS TABLE
-- Tracks who can approve each request (denormalized for performance)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.approval_request_approvers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Approval level this user can approve
  approval_level INTEGER NOT NULL,

  -- Status
  has_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  decision TEXT CHECK (decision IN ('approved', 'rejected')),
  comments TEXT,

  -- Notification tracking
  notified_at TIMESTAMPTZ,
  notification_sent BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT approval_request_approvers_unique UNIQUE(request_id, user_id, approval_level)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_approval_request_approvers_request ON public.approval_request_approvers(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_approvers_user ON public.approval_request_approvers(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_approvers_pending ON public.approval_request_approvers(user_id, has_approved) WHERE has_approved = false;

-- Comments
COMMENT ON TABLE public.approval_request_approvers IS 'Tracks individual approvers for each request (denormalized for queries)';

-- =====================================================
-- 4. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_approval_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_approval_workflows_updated_at ON public.approval_workflows;
CREATE TRIGGER update_approval_workflows_updated_at
  BEFORE UPDATE ON public.approval_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_updated_at();

DROP TRIGGER IF EXISTS update_approval_requests_updated_at ON public.approval_requests;
CREATE TRIGGER update_approval_requests_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_updated_at();

-- Function to create approvers when approval request is created
CREATE OR REPLACE FUNCTION create_approval_request_approvers()
RETURNS TRIGGER AS $$
DECLARE
  workflow_record RECORD;
  approval_level RECORD;
  approver_user_id UUID;
BEGIN
  -- Get the workflow configuration
  SELECT * INTO workflow_record
  FROM approval_workflows
  WHERE id = NEW.workflow_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Parse approval chain and create approver records
  FOR approval_level IN
    SELECT
      (value->>'level')::integer as level,
      value->>'role' as role,
      (value->>'required_approvers')::integer as required_approvers,
      value->'specific_users' as specific_users
    FROM jsonb_array_elements(workflow_record.approval_chain)
  LOOP
    -- If specific users are defined, add them
    IF approval_level.specific_users IS NOT NULL THEN
      FOR approver_user_id IN
        SELECT (value::text)::uuid
        FROM jsonb_array_elements_text(approval_level.specific_users)
      LOOP
        INSERT INTO approval_request_approvers (request_id, user_id, approval_level)
        VALUES (NEW.id, approver_user_id, approval_level.level)
        ON CONFLICT (request_id, user_id, approval_level) DO NOTHING;
      END LOOP;
    ELSE
      -- Add all users with the specified role in the org
      INSERT INTO approval_request_approvers (request_id, user_id, approval_level)
      SELECT NEW.id, om.user_id, approval_level.level
      FROM org_members om
      WHERE om.org_id = NEW.org_id
        AND om.role = approval_level.role
        AND om.user_id != NEW.requested_by -- Don't add requester unless self-approval allowed
      ON CONFLICT (request_id, user_id, approval_level) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create approvers
DROP TRIGGER IF EXISTS on_approval_request_create_approvers ON public.approval_requests;
CREATE TRIGGER on_approval_request_create_approvers
  AFTER INSERT ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_approval_request_approvers();

-- Function to create in-app notifications for approvers
CREATE OR REPLACE FUNCTION create_approval_notifications()
RETURNS TRIGGER AS $$
DECLARE
  grant_record RECORD;
  approver_record RECORD;
BEGIN
  -- Get grant information
  SELECT title INTO grant_record
  FROM org_grants_saved
  WHERE id = NEW.grant_id;

  -- Create notification for each approver at current level
  FOR approver_record IN
    SELECT user_id
    FROM approval_request_approvers
    WHERE request_id = NEW.id
      AND approval_level = NEW.current_approval_level
      AND has_approved = false
  LOOP
    INSERT INTO in_app_notifications (
      user_id,
      org_id,
      type,
      title,
      message,
      action_url,
      action_label
    )
    VALUES (
      approver_record.user_id,
      NEW.org_id,
      'system',
      'Approval Required: ' || COALESCE(grant_record.title, 'Grant Application'),
      'A grant stage transition requires your approval: ' || NEW.from_stage || ' → ' || NEW.to_stage,
      '/pipeline?approval=' || NEW.id,
      'Review Request'
    );

    -- Mark as notified
    UPDATE approval_request_approvers
    SET notified_at = NOW(), notification_sent = true
    WHERE request_id = NEW.id
      AND user_id = approver_record.user_id
      AND approval_level = NEW.current_approval_level;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create notifications on new request
DROP TRIGGER IF EXISTS on_approval_request_notify ON public.approval_requests;
CREATE TRIGGER on_approval_request_notify
  AFTER INSERT ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_approval_notifications();

-- Trigger to create notifications when approval level advances
DROP TRIGGER IF EXISTS on_approval_level_advance_notify ON public.approval_requests;
CREATE TRIGGER on_approval_level_advance_notify
  AFTER UPDATE OF current_approval_level ON public.approval_requests
  FOR EACH ROW
  WHEN (NEW.current_approval_level > OLD.current_approval_level AND NEW.status = 'pending')
  EXECUTE FUNCTION create_approval_notifications();

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_approvers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- APPROVAL WORKFLOWS POLICIES
-- =====================================================

-- Members can view workflows in their organization
DROP POLICY IF EXISTS "Members can view org workflows" ON public.approval_workflows;
CREATE POLICY "Members can view org workflows"
  ON public.approval_workflows
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Admins can create workflows
DROP POLICY IF EXISTS "Admins can create workflows" ON public.approval_workflows;
CREATE POLICY "Admins can create workflows"
  ON public.approval_workflows
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update workflows
DROP POLICY IF EXISTS "Admins can update workflows" ON public.approval_workflows;
CREATE POLICY "Admins can update workflows"
  ON public.approval_workflows
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete workflows
DROP POLICY IF EXISTS "Admins can delete workflows" ON public.approval_workflows;
CREATE POLICY "Admins can delete workflows"
  ON public.approval_workflows
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- APPROVAL REQUESTS POLICIES
-- =====================================================

-- Members can view approval requests in their organization
DROP POLICY IF EXISTS "Members can view org approval requests" ON public.approval_requests;
CREATE POLICY "Members can view org approval requests"
  ON public.approval_requests
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Members can create approval requests
DROP POLICY IF EXISTS "Members can create approval requests" ON public.approval_requests;
CREATE POLICY "Members can create approval requests"
  ON public.approval_requests
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
    AND requested_by = auth.uid()
  );

-- Approvers and requesters can update requests (for approvals/cancellations)
DROP POLICY IF EXISTS "Approvers can update requests" ON public.approval_requests;
CREATE POLICY "Approvers can update requests"
  ON public.approval_requests
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
    AND (
      -- Requester can cancel
      requested_by = auth.uid()
      OR
      -- Approver can update (approve/reject)
      auth.uid() IN (
        SELECT user_id FROM approval_request_approvers WHERE request_id = id
      )
    )
  );

-- =====================================================
-- APPROVAL REQUEST APPROVERS POLICIES
-- =====================================================

-- Members can view approvers in their organization
DROP POLICY IF EXISTS "Members can view approvers" ON public.approval_request_approvers;
CREATE POLICY "Members can view approvers"
  ON public.approval_request_approvers
  FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM approval_requests
      WHERE org_id IN (
        SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
      )
    )
  );

-- Service role can insert approvers (via trigger)
DROP POLICY IF EXISTS "Service can insert approvers" ON public.approval_request_approvers;
CREATE POLICY "Service can insert approvers"
  ON public.approval_request_approvers
  FOR INSERT
  WITH CHECK (true);

-- Approvers can update their own approval status
DROP POLICY IF EXISTS "Approvers can update own status" ON public.approval_request_approvers;
CREATE POLICY "Approvers can update own status"
  ON public.approval_request_approvers
  FOR UPDATE
  USING (user_id = auth.uid());
