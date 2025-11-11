-- =====================================================
-- AI-Powered Features Migration
-- Created: 2025-01-24
-- Purpose: Add database tables for AI-powered grant features
--          - NOFO PDF Summarizer
--          - Grant Recommendations
--          - Smart Tagging & Categorization
--          - Success Probability Scoring
-- =====================================================

-- =====================================================
-- 1. GRANT AI SUMMARIES TABLE
-- Store AI-generated summaries of NOFO PDFs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grant_ai_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Grant reference (can be catalog or saved grant)
  catalog_grant_id UUID REFERENCES public.grants_catalog(id) ON DELETE CASCADE,
  saved_grant_id UUID REFERENCES public.org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- AI provider details
  provider TEXT NOT NULL, -- 'openai', 'claude', 'local'
  model TEXT NOT NULL, -- e.g., 'gpt-4', 'claude-3-opus'

  -- Summary data (JSONB for flexibility)
  summary JSONB NOT NULL,

  -- Extracted key fields (denormalized for quick access)
  primary_deadline DATE,
  application_deadline DATE,
  cost_sharing_required BOOLEAN,
  total_program_funding NUMERIC,
  max_award_amount NUMERIC,
  min_award_amount NUMERIC,
  expected_awards INTEGER,

  -- Processing metadata
  source_url TEXT, -- URL of the PDF
  processing_time_ms INTEGER,
  token_count INTEGER,
  cost_usd NUMERIC(10, 4),

  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,

  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ, -- Optional cache expiration

  -- Constraints
  CONSTRAINT grant_ai_summaries_grant_check CHECK (
    (catalog_grant_id IS NOT NULL AND saved_grant_id IS NULL) OR
    (catalog_grant_id IS NULL AND saved_grant_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grant_ai_summaries_catalog ON public.grant_ai_summaries(catalog_grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_ai_summaries_saved ON public.grant_ai_summaries(saved_grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_ai_summaries_org ON public.grant_ai_summaries(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_ai_summaries_status ON public.grant_ai_summaries(status);
CREATE INDEX IF NOT EXISTS idx_grant_ai_summaries_deadline ON public.grant_ai_summaries(primary_deadline) WHERE primary_deadline IS NOT NULL;

-- Comments
COMMENT ON TABLE public.grant_ai_summaries IS 'AI-generated summaries of NOFO PDFs with extracted key information';
COMMENT ON COLUMN public.grant_ai_summaries.summary IS 'Full AI summary as JSONB - includes key dates, eligibility, focus areas, etc.';
COMMENT ON COLUMN public.grant_ai_summaries.provider IS 'AI provider used to generate summary';

-- =====================================================
-- 2. GRANT TAGS TABLE
-- Smart categorization and tagging
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grant_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Tag details
  tag_name TEXT NOT NULL UNIQUE,
  tag_slug TEXT NOT NULL UNIQUE,
  tag_category TEXT, -- 'focus_area', 'eligibility', 'funding_type', 'custom'

  -- Metadata
  description TEXT,
  color TEXT, -- Hex color for UI display

  -- Auto-tagging
  ai_generated BOOLEAN DEFAULT FALSE,
  confidence_score NUMERIC(3, 2), -- 0.00 to 1.00 for AI-generated tags

  -- Usage stats
  usage_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT grant_tags_category_check CHECK (
    tag_category IN ('focus_area', 'eligibility', 'funding_type', 'geographic', 'custom', NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grant_tags_category ON public.grant_tags(tag_category);
CREATE INDEX IF NOT EXISTS idx_grant_tags_ai_generated ON public.grant_tags(ai_generated);

-- Comments
COMMENT ON TABLE public.grant_tags IS 'Tags for categorizing grants - can be manual or AI-generated';
COMMENT ON COLUMN public.grant_tags.confidence_score IS 'AI confidence score for auto-generated tags (0.00-1.00)';

-- =====================================================
-- 3. GRANT TAG ASSIGNMENTS TABLE
-- Many-to-many relationship between grants and tags
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grant_tag_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  grant_id UUID NOT NULL REFERENCES public.grants_catalog(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.grant_tags(id) ON DELETE CASCADE,

  -- Assignment metadata
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL if AI-assigned
  ai_assigned BOOLEAN DEFAULT FALSE,
  confidence_score NUMERIC(3, 2), -- For AI assignments

  -- Timestamps
  assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  UNIQUE(grant_id, tag_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grant_tag_assignments_grant ON public.grant_tag_assignments(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_tag_assignments_tag ON public.grant_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_grant_tag_assignments_ai ON public.grant_tag_assignments(ai_assigned);

-- Comments
COMMENT ON TABLE public.grant_tag_assignments IS 'Links grants to tags - supports both manual and AI tagging';

-- =====================================================
-- 4. GRANT RECOMMENDATIONS TABLE
-- Cached grant recommendations for users/orgs
-- =====================================================
-- Drop existing view if it exists (cannot have indexes on views)
DROP VIEW IF EXISTS public.grant_recommendations CASCADE;

CREATE TABLE IF NOT EXISTS public.grant_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Target user/org
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Recommended grant
  grant_id UUID NOT NULL REFERENCES public.grants_catalog(id) ON DELETE CASCADE,

  -- Recommendation details
  recommendation_score NUMERIC(5, 4) NOT NULL, -- 0.0000 to 1.0000
  recommendation_reason TEXT, -- Human-readable explanation

  -- Ranking
  rank INTEGER, -- 1 = highest recommendation

  -- Factors contributing to recommendation (JSONB for flexibility)
  factors JSONB, -- e.g., {"eligibility_match": 0.95, "past_success": 0.85, "team_interest": 0.70}

  -- Interaction tracking
  viewed BOOLEAN DEFAULT FALSE,
  viewed_at TIMESTAMPTZ,
  saved BOOLEAN DEFAULT FALSE,
  saved_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,

  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ, -- Cache expiration

  -- Constraints
  UNIQUE(user_id, grant_id, generated_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grant_recommendations_user ON public.grant_recommendations(user_id, recommendation_score DESC);
CREATE INDEX IF NOT EXISTS idx_grant_recommendations_org ON public.grant_recommendations(org_id, recommendation_score DESC);
CREATE INDEX IF NOT EXISTS idx_grant_recommendations_grant ON public.grant_recommendations(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_recommendations_score ON public.grant_recommendations(recommendation_score DESC);
CREATE INDEX IF NOT EXISTS idx_grant_recommendations_expires ON public.grant_recommendations(expires_at) WHERE expires_at IS NOT NULL;

-- Comments
COMMENT ON TABLE public.grant_recommendations IS 'AI-generated grant recommendations based on collaborative filtering and user behavior';
COMMENT ON COLUMN public.grant_recommendations.factors IS 'JSONB containing breakdown of recommendation factors';

-- =====================================================
-- 5. GRANT SUCCESS SCORES TABLE
-- Probability of success predictions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grant_success_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Grant and org
  grant_id UUID NOT NULL REFERENCES public.grants_catalog(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Success prediction
  success_probability NUMERIC(5, 4) NOT NULL, -- 0.0000 to 1.0000 (e.g., 0.7842 = 78.42%)
  confidence_interval NUMERIC(5, 4), -- Uncertainty measure

  -- Score breakdown (JSONB for flexibility)
  score_factors JSONB, -- e.g., {"agency_history": 0.85, "competition": 0.65, "org_fit": 0.90}

  -- Contributing data points
  historical_win_rate NUMERIC(5, 4), -- Org's past success rate with this agency
  estimated_applicants INTEGER, -- Competition level
  eligibility_match_score NUMERIC(5, 4), -- How well org matches eligibility

  -- Display helpers
  match_level TEXT CHECK (match_level IN ('excellent', 'good', 'fair', 'poor')),
  recommendation_text TEXT, -- Human-readable recommendation

  -- Model info
  model_version TEXT,

  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ, -- Cache expiration

  -- Constraints
  UNIQUE(grant_id, org_id, calculated_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grant_success_scores_grant ON public.grant_success_scores(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_success_scores_org ON public.grant_success_scores(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_success_scores_probability ON public.grant_success_scores(success_probability DESC);
CREATE INDEX IF NOT EXISTS idx_grant_success_scores_match ON public.grant_success_scores(match_level);

-- Comments
COMMENT ON TABLE public.grant_success_scores IS 'AI-predicted probability of success for org-grant pairs';
COMMENT ON COLUMN public.grant_success_scores.success_probability IS 'Predicted probability of winning the grant (0.00-1.00)';
COMMENT ON COLUMN public.grant_success_scores.score_factors IS 'JSONB breakdown of factors contributing to the score';

-- =====================================================
-- 6. SEED DATA - Common Grant Tags
-- =====================================================
INSERT INTO public.grant_tags (tag_name, tag_slug, tag_category, description, color) VALUES
  ('Education', 'education', 'focus_area', 'Educational programs and initiatives', '#3B82F6'),
  ('Healthcare', 'healthcare', 'focus_area', 'Health and medical programs', '#EF4444'),
  ('Environment', 'environment', 'focus_area', 'Environmental conservation and sustainability', '#10B981'),
  ('Technology', 'technology', 'focus_area', 'Technology and innovation', '#8B5CF6'),
  ('Community Development', 'community-development', 'focus_area', 'Community building and development', '#F59E0B'),
  ('Arts & Culture', 'arts-culture', 'focus_area', 'Arts, culture, and humanities', '#EC4899'),
  ('Research', 'research', 'focus_area', 'Research and development', '#6366F1'),
  ('Nonprofits', 'nonprofits', 'eligibility', 'Eligible for nonprofit organizations', '#14B8A6'),
  ('Small Business', 'small-business', 'eligibility', 'Eligible for small businesses', '#F97316'),
  ('State/Local Gov', 'state-local-gov', 'eligibility', 'Eligible for state and local governments', '#06B6D4'),
  ('Universities', 'universities', 'eligibility', 'Eligible for higher education institutions', '#8B5CF6'),
  ('Capacity Building', 'capacity-building', 'funding_type', 'Organizational capacity and development', '#84CC16'),
  ('Program Support', 'program-support', 'funding_type', 'Direct program funding', '#22C55E'),
  ('Capital Projects', 'capital-projects', 'funding_type', 'Infrastructure and capital projects', '#EAB308'),
  ('Rural', 'rural', 'geographic', 'Focused on rural areas', '#059669'),
  ('Urban', 'urban', 'geographic', 'Focused on urban areas', '#0EA5E9')
ON CONFLICT (tag_slug) DO NOTHING;

-- =====================================================
-- 7. ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE public.grant_ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_success_scores ENABLE ROW LEVEL SECURITY;

-- Grant AI Summaries: Org members can view their org's summaries
DROP POLICY IF EXISTS "Org members can view summaries" ON public.grant_ai_summaries;
CREATE POLICY "Org members can view summaries"
  ON public.grant_ai_summaries FOR SELECT
  USING (
    org_id IS NULL OR -- Public summaries
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = grant_ai_summaries.org_id
        AND org_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can manage summaries" ON public.grant_ai_summaries;
CREATE POLICY "Service role can manage summaries"
  ON public.grant_ai_summaries FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can create summaries" ON public.grant_ai_summaries;
CREATE POLICY "Authenticated users can create summaries"
  ON public.grant_ai_summaries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Grant Tags: Public read
DROP POLICY IF EXISTS "Anyone can view tags" ON public.grant_tags;
CREATE POLICY "Anyone can view tags"
  ON public.grant_tags FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Service role can manage tags" ON public.grant_tags;
CREATE POLICY "Service role can manage tags"
  ON public.grant_tags FOR ALL
  USING (auth.role() = 'service_role');

-- Grant Tag Assignments: Public read
DROP POLICY IF EXISTS "Anyone can view tag assignments" ON public.grant_tag_assignments;
CREATE POLICY "Anyone can view tag assignments"
  ON public.grant_tag_assignments FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Service role can manage tag assignments" ON public.grant_tag_assignments;
CREATE POLICY "Service role can manage tag assignments"
  ON public.grant_tag_assignments FOR ALL
  USING (auth.role() = 'service_role');

-- Grant Recommendations: Users see their own recommendations
DROP POLICY IF EXISTS "Users can view their recommendations" ON public.grant_recommendations;
CREATE POLICY "Users can view their recommendations"
  ON public.grant_recommendations FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their recommendations" ON public.grant_recommendations;
CREATE POLICY "Users can update their recommendations"
  ON public.grant_recommendations FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage recommendations" ON public.grant_recommendations;
CREATE POLICY "Service role can manage recommendations"
  ON public.grant_recommendations FOR ALL
  USING (auth.role() = 'service_role');

-- Grant Success Scores: Org members can view their org's scores
DROP POLICY IF EXISTS "Org members can view success scores" ON public.grant_success_scores;
CREATE POLICY "Org members can view success scores"
  ON public.grant_success_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = grant_success_scores.org_id
        AND org_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can manage success scores" ON public.grant_success_scores;
CREATE POLICY "Service role can manage success scores"
  ON public.grant_success_scores FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 8. FUNCTIONS FOR AI FEATURES
-- =====================================================

-- Function to update tag usage count
CREATE OR REPLACE FUNCTION increment_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.grant_tags
  SET usage_count = usage_count + 1
  WHERE id = NEW.tag_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS increment_tag_usage ON public.grant_tag_assignments;
CREATE TRIGGER increment_tag_usage
  AFTER INSERT ON public.grant_tag_assignments
  FOR EACH ROW
  EXECUTE FUNCTION increment_tag_usage_count();

-- Function to clean expired recommendations
CREATE OR REPLACE FUNCTION clean_expired_recommendations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.grant_recommendations
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired AI summaries
CREATE OR REPLACE FUNCTION clean_expired_ai_summaries()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.grant_ai_summaries
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get top recommended grants for a user
CREATE OR REPLACE FUNCTION get_user_recommendations(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  grant_id UUID,
  recommendation_score NUMERIC,
  recommendation_reason TEXT,
  grant_title TEXT,
  grant_agency TEXT,
  grant_close_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gr.grant_id,
    gr.recommendation_score,
    gr.recommendation_reason,
    gc.title as grant_title,
    gc.agency as grant_agency,
    gc.close_date as grant_close_date
  FROM public.grant_recommendations gr
  JOIN public.grants_catalog gc ON gr.grant_id = gc.id
  WHERE gr.user_id = p_user_id
    AND gr.dismissed = FALSE
    AND gc.is_active = TRUE
    AND (gr.expires_at IS NULL OR gr.expires_at > NOW())
  ORDER BY gr.recommendation_score DESC, gr.generated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_grant_recommendations_user_org_score
  ON public.grant_recommendations(user_id, org_id, recommendation_score DESC)
  WHERE NOT dismissed;

CREATE INDEX IF NOT EXISTS idx_grant_success_scores_org_probability
  ON public.grant_success_scores(org_id, success_probability DESC);

-- =====================================================
-- 10. COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN public.grant_ai_summaries.summary IS 'Full JSONB summary structure: {
  "key_dates": {"application_deadline": "2025-03-15", "award_date": "2025-06-01"},
  "eligibility": {"organizations": ["nonprofit", "university"], "geographic": ["nationwide"]},
  "focus_areas": ["education", "community-development"],
  "funding": {"total": 5000000, "max_award": 500000, "min_award": 50000, "expected_awards": 15},
  "priorities": ["STEM education", "underserved communities"],
  "cost_sharing": {"required": true, "percentage": 20},
  "restrictions": ["No indirect costs", "Must serve low-income areas"]
}';

COMMENT ON COLUMN public.grant_recommendations.factors IS 'JSONB breakdown: {
  "eligibility_match": 0.95,
  "past_success_rate": 0.85,
  "team_interest": 0.70,
  "org_capacity": 0.80,
  "funding_fit": 0.90
}';

COMMENT ON COLUMN public.grant_success_scores.score_factors IS 'JSONB breakdown: {
  "agency_history": 0.85,
  "competition_level": 0.65,
  "org_fit": 0.90,
  "funding_amount_fit": 0.75,
  "timeline_feasibility": 0.88
}';
