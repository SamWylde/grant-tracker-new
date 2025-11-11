-- Migration: Add Post-Award Financials & Compliance Tracking
-- Description: Track budgets, disbursements, payment schedules, and compliance requirements

-- ============================================================================
-- Grant Budgets Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS grant_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Budget amounts
  proposed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  awarded_amount NUMERIC(12,2) DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  total_committed NUMERIC(12,2) DEFAULT 0,

  -- Match/cost share requirements
  match_required BOOLEAN DEFAULT false,
  match_amount NUMERIC(12,2) DEFAULT 0,
  match_received NUMERIC(12,2) DEFAULT 0,

  -- Period
  budget_period_start DATE,
  budget_period_end DATE,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'active', 'closed')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grant_budgets_grant_id ON grant_budgets(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_budgets_org_id ON grant_budgets(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_budgets_status ON grant_budgets(status);

-- RLS Policies
ALTER TABLE grant_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY grant_budgets_select ON grant_budgets
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY grant_budgets_insert ON grant_budgets
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY grant_budgets_update ON grant_budgets
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY grant_budgets_delete ON grant_budgets
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE grant_budgets IS 'Budget tracking for awarded grants';

-- ============================================================================
-- Budget Line Items Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES grant_budgets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Line item details
  category TEXT NOT NULL CHECK (category IN (
    'personnel', 'fringe_benefits', 'travel', 'equipment',
    'supplies', 'contractual', 'construction', 'other_direct',
    'indirect_costs', 'match_in_kind', 'match_cash'
  )),
  description TEXT NOT NULL,
  line_number INTEGER,

  -- Amounts
  proposed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  awarded_amount NUMERIC(12,2) DEFAULT 0,
  spent_amount NUMERIC(12,2) DEFAULT 0,
  committed_amount NUMERIC(12,2) DEFAULT 0,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_line_items_budget_id ON budget_line_items(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_line_items_category ON budget_line_items(category);

-- RLS Policies
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY budget_line_items_select ON budget_line_items
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY budget_line_items_insert ON budget_line_items
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY budget_line_items_update ON budget_line_items
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY budget_line_items_delete ON budget_line_items
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE budget_line_items IS 'Detailed budget line items by cost category';

-- ============================================================================
-- Disbursements Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES grant_budgets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Disbursement details
  disbursement_type TEXT NOT NULL CHECK (disbursement_type IN ('payment_received', 'expense', 'adjustment')),
  amount NUMERIC(12,2) NOT NULL,
  disbursement_date DATE NOT NULL,

  -- Categorization
  category TEXT CHECK (category IN (
    'personnel', 'fringe_benefits', 'travel', 'equipment',
    'supplies', 'contractual', 'construction', 'other_direct',
    'indirect_costs', 'match_in_kind', 'match_cash'
  )),
  line_item_id UUID REFERENCES budget_line_items(id) ON DELETE SET NULL,

  -- Payment tracking
  payment_method TEXT CHECK (payment_method IN ('ach', 'wire', 'check', 'credit_card', 'in_kind', 'other')),
  reference_number TEXT,
  vendor_payee TEXT,

  -- Documentation
  description TEXT NOT NULL,
  receipt_url TEXT,
  notes TEXT,

  -- Approval
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,

  -- Reconciliation
  reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_disbursements_budget_id ON disbursements(budget_id);
CREATE INDEX IF NOT EXISTS idx_disbursements_org_id ON disbursements(org_id);
CREATE INDEX IF NOT EXISTS idx_disbursements_date ON disbursements(disbursement_date DESC);
CREATE INDEX IF NOT EXISTS idx_disbursements_category ON disbursements(category);
CREATE INDEX IF NOT EXISTS idx_disbursements_type ON disbursements(disbursement_type);

-- RLS Policies
ALTER TABLE disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY disbursements_select ON disbursements
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY disbursements_insert ON disbursements
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY disbursements_update ON disbursements
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY disbursements_delete ON disbursements
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE disbursements IS 'Track payments received and expenses paid from grant budgets';

-- ============================================================================
-- Payment Schedules Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES grant_budgets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Schedule details
  payment_name TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('advance', 'reimbursement', 'cost_reimbursement', 'milestone', 'quarterly', 'annual')),
  expected_amount NUMERIC(12,2) NOT NULL,
  expected_date DATE NOT NULL,

  -- Requirements
  deliverable_required TEXT,
  report_required TEXT,
  report_due_date DATE,
  report_submitted BOOLEAN DEFAULT false,
  report_submitted_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'received', 'delayed', 'cancelled')),
  actual_amount NUMERIC(12,2),
  actual_date DATE,
  received BOOLEAN DEFAULT false,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_schedules_budget_id ON payment_schedules(budget_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_org_id ON payment_schedules(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_expected_date ON payment_schedules(expected_date);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_status ON payment_schedules(status);

-- RLS Policies
ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_schedules_select ON payment_schedules
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY payment_schedules_insert ON payment_schedules
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY payment_schedules_update ON payment_schedules
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY payment_schedules_delete ON payment_schedules
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE payment_schedules IS 'Scheduled grant payments and disbursement tracking';

-- ============================================================================
-- Compliance Requirements Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Requirement details
  requirement_type TEXT NOT NULL CHECK (requirement_type IN (
    'federal_regulation', 'state_regulation', 'indirect_cost_agreement',
    'match_requirement', 'audit_requirement', 'reporting_requirement',
    'certification', 'policy', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,

  -- Compliance details
  regulation_reference TEXT,
  policy_url TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'non_compliant', 'waived')),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),

  -- Deadlines
  due_date DATE,
  reminder_days_before INTEGER DEFAULT 30,

  -- Documentation
  documentation_required BOOLEAN DEFAULT false,
  documentation_url TEXT,

  -- Priority
  is_critical BOOLEAN DEFAULT false,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_grant_id ON compliance_requirements(grant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_org_id ON compliance_requirements(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_status ON compliance_requirements(status);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_due_date ON compliance_requirements(due_date);

-- RLS Policies
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_requirements_select ON compliance_requirements
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY compliance_requirements_insert ON compliance_requirements
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY compliance_requirements_update ON compliance_requirements
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY compliance_requirements_delete ON compliance_requirements
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE compliance_requirements IS 'Track compliance obligations and requirements for grants';

-- ============================================================================
-- Helper Views
-- ============================================================================

-- Budget summary view
CREATE OR REPLACE VIEW grant_budget_summary AS
SELECT
  gb.id AS budget_id,
  gb.grant_id,
  gb.org_id,
  gb.proposed_amount,
  gb.awarded_amount,
  gb.total_spent,
  gb.total_committed,
  gb.awarded_amount - gb.total_spent AS remaining_amount,
  CASE
    WHEN gb.awarded_amount > 0
    THEN (gb.total_spent / gb.awarded_amount) * 100
    ELSE 0
  END AS percent_spent,
  gb.match_required,
  gb.match_amount,
  gb.match_received,
  CASE
    WHEN gb.match_required AND gb.match_amount > 0
    THEN (gb.match_received / gb.match_amount) * 100
    ELSE 0
  END AS match_percent_complete,
  gb.status,
  COUNT(DISTINCT bli.id) AS line_item_count,
  COUNT(DISTINCT d.id) AS disbursement_count
FROM grant_budgets gb
LEFT JOIN budget_line_items bli ON bli.budget_id = gb.id
LEFT JOIN disbursements d ON d.budget_id = gb.id
GROUP BY gb.id;

COMMENT ON VIEW grant_budget_summary IS 'Aggregated budget metrics per grant';

-- Compliance summary view
CREATE OR REPLACE VIEW grant_compliance_summary AS
SELECT
  cr.grant_id,
  cr.org_id,
  COUNT(*) AS total_requirements,
  COUNT(*) FILTER (WHERE cr.completed = true) AS completed_requirements,
  COUNT(*) FILTER (WHERE cr.is_critical = true) AS critical_requirements,
  COUNT(*) FILTER (WHERE cr.is_critical = true AND cr.completed = false) AS critical_incomplete,
  COUNT(*) FILTER (WHERE cr.due_date IS NOT NULL AND cr.due_date < CURRENT_DATE AND cr.completed = false) AS overdue_requirements,
  CASE
    WHEN COUNT(*) > 0
    THEN (COUNT(*) FILTER (WHERE cr.completed = true)::NUMERIC / COUNT(*)::NUMERIC) * 100
    ELSE 0
  END AS compliance_percentage
FROM compliance_requirements cr
GROUP BY cr.grant_id, cr.org_id;

COMMENT ON VIEW grant_compliance_summary IS 'Compliance completeness metrics per grant';

-- ============================================================================
-- Triggers for automatic calculations
-- ============================================================================

-- Function to update budget totals when disbursements change
CREATE OR REPLACE FUNCTION update_budget_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_spent in grant_budgets
  UPDATE grant_budgets
  SET
    total_spent = COALESCE((
      SELECT SUM(amount)
      FROM disbursements
      WHERE budget_id = COALESCE(NEW.budget_id, OLD.budget_id)
      AND disbursement_type = 'expense'
      AND approved = true
    ), 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.budget_id, OLD.budget_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_budget_totals ON disbursements;
CREATE TRIGGER trigger_update_budget_totals
  AFTER INSERT OR UPDATE OR DELETE ON disbursements
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_totals();

COMMENT ON FUNCTION update_budget_totals IS 'Automatically updates budget totals when disbursements change';

-- Function to update line item totals
CREATE OR REPLACE FUNCTION update_line_item_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update spent_amount in budget_line_items
  UPDATE budget_line_items
  SET
    spent_amount = COALESCE((
      SELECT SUM(amount)
      FROM disbursements
      WHERE line_item_id = COALESCE(NEW.line_item_id, OLD.line_item_id)
      AND disbursement_type = 'expense'
      AND approved = true
    ), 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.line_item_id, OLD.line_item_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_line_item_totals ON disbursements;
CREATE TRIGGER trigger_update_line_item_totals
  AFTER INSERT OR UPDATE OR DELETE ON disbursements
  FOR EACH ROW
  EXECUTE FUNCTION update_line_item_totals();

COMMENT ON FUNCTION update_line_item_totals IS 'Automatically updates line item totals when disbursements change';
