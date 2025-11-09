-- Migration: Add grant tasks for workflow management
-- Created: 2025-01-15
-- Description: Creates grant_tasks table to break down each grant into actionable subtasks

-- Create grant_tasks table
CREATE TABLE IF NOT EXISTS grant_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT CHECK (task_type IN ('research', 'budget', 'narrative', 'letters', 'documents', 'submission', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_grant_tasks_grant_id ON grant_tasks(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_tasks_org_id ON grant_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_tasks_assigned_to ON grant_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_grant_tasks_status ON grant_tasks(status);

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_grant_tasks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
    NEW.completed_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER grant_tasks_updated_at
  BEFORE UPDATE ON grant_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_grant_tasks_timestamp();

-- Enable Row Level Security
ALTER TABLE grant_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view tasks for grants in their organization
CREATE POLICY "Users can view tasks in their organization"
  ON grant_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = grant_tasks.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- Users can insert tasks for grants in their organization
CREATE POLICY "Users can create tasks in their organization"
  ON grant_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = grant_tasks.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- Users can update tasks for grants in their organization
CREATE POLICY "Users can update tasks in their organization"
  ON grant_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = grant_tasks.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- Users can delete tasks for grants in their organization
CREATE POLICY "Users can delete tasks in their organization"
  ON grant_tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = grant_tasks.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- Create a function to initialize default tasks for a new grant
CREATE OR REPLACE FUNCTION create_default_grant_tasks(
  p_grant_id UUID,
  p_org_id UUID,
  p_user_id UUID
)
RETURNS void AS $$
BEGIN
  -- Insert default task templates
  INSERT INTO grant_tasks (grant_id, org_id, title, description, task_type, position, is_required, created_by)
  VALUES
    (p_grant_id, p_org_id, 'Research grant requirements', 'Review eligibility, requirements, and evaluation criteria', 'research', 1, true, p_user_id),
    (p_grant_id, p_org_id, 'Draft project narrative', 'Write project description, goals, and methodology', 'narrative', 2, true, p_user_id),
    (p_grant_id, p_org_id, 'Prepare budget', 'Create detailed budget and budget narrative', 'budget', 3, true, p_user_id),
    (p_grant_id, p_org_id, 'Gather supporting documents', 'Collect required attachments (501c3, financial statements, etc.)', 'documents', 4, true, p_user_id),
    (p_grant_id, p_org_id, 'Obtain letters of support', 'Request and collect letters from partners and stakeholders', 'letters', 5, false, p_user_id),
    (p_grant_id, p_org_id, 'Submit application', 'Final review and submission via Grants.gov', 'submission', 6, true, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_default_grant_tasks(UUID, UUID, UUID) TO authenticated;

COMMENT ON TABLE grant_tasks IS 'Task breakdown for grant applications - tracks workflow progress';
COMMENT ON FUNCTION create_default_grant_tasks IS 'Creates standard task templates when a grant is saved';
