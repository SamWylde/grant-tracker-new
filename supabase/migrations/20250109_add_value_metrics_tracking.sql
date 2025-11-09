-- Add value metrics tracking tables for grant submissions and awards
-- This enables calculation of: % deadlines met, # grants submitted, time-to-submit, awards won

-- Add status field to existing org_grants_saved table
ALTER TABLE org_grants_saved
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'in_progress', 'submitted', 'awarded', 'rejected', 'withdrawn'));

-- Create grant_submissions table to track submission details
CREATE TABLE IF NOT EXISTS grant_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Submission details
  submitted_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_date TIMESTAMPTZ, -- Copy of grant close_date at time of submission
  met_deadline BOOLEAN GENERATED ALWAYS AS (submitted_date <= deadline_date) STORED,
  days_to_submit INTEGER, -- Time from saved_at to submitted_date in days

  -- Application details
  requested_amount NUMERIC(12, 2),
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(grant_id) -- One submission per grant
);

-- Create grant_awards table to track award outcomes
CREATE TABLE IF NOT EXISTS grant_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES org_grants_saved(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES grant_submissions(id) ON DELETE SET NULL,

  -- Award details
  award_status TEXT NOT NULL CHECK (award_status IN ('awarded', 'rejected', 'pending', 'waitlisted')),
  award_date TIMESTAMPTZ,
  awarded_amount NUMERIC(12, 2),

  -- Additional info
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(grant_id) -- One award record per grant
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_grant_submissions_org_id ON grant_submissions(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_submissions_grant_id ON grant_submissions(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_submissions_submitted_date ON grant_submissions(submitted_date);
CREATE INDEX IF NOT EXISTS idx_grant_submissions_met_deadline ON grant_submissions(met_deadline);

CREATE INDEX IF NOT EXISTS idx_grant_awards_org_id ON grant_awards(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_awards_grant_id ON grant_awards(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_awards_award_status ON grant_awards(award_status);
CREATE INDEX IF NOT EXISTS idx_grant_awards_award_date ON grant_awards(award_date);

-- Enable Row Level Security
ALTER TABLE grant_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_awards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for grant_submissions
CREATE POLICY "Users can view submissions from their orgs"
  ON grant_submissions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert submissions to their orgs"
  ON grant_submissions FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update submissions in their orgs"
  ON grant_submissions FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete submissions from their orgs"
  ON grant_submissions FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for grant_awards
CREATE POLICY "Users can view awards from their orgs"
  ON grant_awards FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert awards to their orgs"
  ON grant_awards FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update awards in their orgs"
  ON grant_awards FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete awards from their orgs"
  ON grant_awards FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_grant_submissions_updated_at
  BEFORE UPDATE ON grant_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grant_awards_updated_at
  BEFORE UPDATE ON grant_awards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for easy metrics calculation
CREATE OR REPLACE VIEW grant_metrics_summary AS
SELECT
  g.org_id,

  -- Overall counts
  COUNT(DISTINCT g.id) as total_grants_saved,
  COUNT(DISTINCT s.id) as total_grants_submitted,
  COUNT(DISTINCT CASE WHEN a.award_status = 'awarded' THEN a.id END) as total_grants_awarded,

  -- Deadline metrics
  COUNT(DISTINCT CASE WHEN s.met_deadline = true THEN s.id END) as deadlines_met,
  COUNT(DISTINCT CASE WHEN s.met_deadline = false THEN s.id END) as deadlines_missed,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN s.met_deadline = true THEN s.id END)::numeric /
    NULLIF(COUNT(DISTINCT s.id), 0),
    2
  ) as deadline_success_rate,

  -- Time metrics
  ROUND(AVG(s.days_to_submit), 1) as avg_days_to_submit,

  -- Award metrics
  SUM(CASE WHEN a.award_status = 'awarded' THEN a.awarded_amount ELSE 0 END) as total_awarded_amount,
  ROUND(AVG(CASE WHEN a.award_status = 'awarded' THEN a.awarded_amount END), 2) as avg_award_amount

FROM org_grants_saved g
LEFT JOIN grant_submissions s ON g.id = s.grant_id
LEFT JOIN grant_awards a ON g.id = a.grant_id
GROUP BY g.org_id;

-- Grant RLS access to the view
ALTER VIEW grant_metrics_summary OWNER TO postgres;

-- Create a function to get metrics for a specific organization and time period
CREATE OR REPLACE FUNCTION get_grant_metrics(
  p_org_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  metric_name TEXT,
  metric_value NUMERIC,
  metric_label TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH metrics AS (
    SELECT
      g.org_id,
      COUNT(DISTINCT g.id) as grants_saved,
      COUNT(DISTINCT s.id) as grants_submitted,
      COUNT(DISTINCT CASE WHEN a.award_status = 'awarded' THEN a.id END) as grants_awarded,
      COUNT(DISTINCT CASE WHEN s.met_deadline = true THEN s.id END) as deadlines_met,
      COUNT(DISTINCT CASE WHEN s.met_deadline = false THEN s.id END) as deadlines_missed,
      AVG(s.days_to_submit) as avg_days_to_submit,
      SUM(CASE WHEN a.award_status = 'awarded' THEN a.awarded_amount ELSE 0 END) as total_awarded
    FROM org_grants_saved g
    LEFT JOIN grant_submissions s ON g.id = s.grant_id
    LEFT JOIN grant_awards a ON g.id = a.grant_id
    WHERE
      g.org_id = p_org_id
      AND (p_start_date IS NULL OR g.created_at >= p_start_date)
      AND g.created_at <= p_end_date
    GROUP BY g.org_id
  )
  SELECT 'grants_saved'::TEXT, grants_saved::NUMERIC, 'Total Grants Saved'::TEXT FROM metrics
  UNION ALL
  SELECT 'grants_submitted'::TEXT, grants_submitted::NUMERIC, '# Grants Submitted'::TEXT FROM metrics
  UNION ALL
  SELECT 'grants_awarded'::TEXT, grants_awarded::NUMERIC, 'Awards Won'::TEXT FROM metrics
  UNION ALL
  SELECT 'deadlines_met'::TEXT, deadlines_met::NUMERIC, 'Deadlines Met'::TEXT FROM metrics
  UNION ALL
  SELECT 'deadlines_missed'::TEXT, deadlines_missed::NUMERIC, 'Deadlines Missed'::TEXT FROM metrics
  UNION ALL
  SELECT 'deadline_success_rate'::TEXT,
    ROUND(100.0 * deadlines_met::NUMERIC / NULLIF(deadlines_met + deadlines_missed, 0), 2),
    '% Deadlines Met'::TEXT
  FROM metrics
  UNION ALL
  SELECT 'avg_days_to_submit'::TEXT, ROUND(avg_days_to_submit::NUMERIC, 1), 'Avg Time to Submit (days)'::TEXT FROM metrics
  UNION ALL
  SELECT 'total_awarded'::TEXT, total_awarded::NUMERIC, 'Total Funding Awarded ($)'::TEXT FROM metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to document the migration
COMMENT ON TABLE grant_submissions IS 'Tracks grant submission details for value metrics including deadline adherence and time-to-submit';
COMMENT ON TABLE grant_awards IS 'Tracks grant award outcomes including amounts and statuses';
COMMENT ON VIEW grant_metrics_summary IS 'Aggregated metrics view for organization grant performance';
COMMENT ON FUNCTION get_grant_metrics IS 'Function to retrieve grant metrics for a specific org and time period';
