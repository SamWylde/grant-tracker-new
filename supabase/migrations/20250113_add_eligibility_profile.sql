-- Migration: Add Eligibility Profile to Organizations
-- Description: Adds fields to organizations table for eligibility matching and auto-filtering

-- ============================================================================
-- Extend Organizations Table
-- ============================================================================

-- Add eligibility profile fields
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_size TEXT
    CHECK (org_size IN ('small', 'medium', 'large', 'nonprofit', 'government', 'educational'));

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS annual_budget_range TEXT
    CHECK (annual_budget_range IN ('0-100k', '100k-500k', '500k-1m', '1m-5m', '5m-10m', '10m+'));

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_locations TEXT[]; -- Array of state codes or regions
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS service_areas TEXT[]; -- Geographic areas served

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS focus_categories TEXT[]; -- Array of funding category codes (AG, AR, ED, etc.)

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS min_grant_amount NUMERIC(12,2); -- Minimum grant amount of interest
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_grant_amount NUMERIC(12,2); -- Maximum grant amount of interest

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS eligibility_notes TEXT; -- Additional eligibility context

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS auto_filter_enabled BOOLEAN DEFAULT false; -- Enable automatic filtering based on profile

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_organizations_focus_categories ON organizations USING GIN (focus_categories);
CREATE INDEX IF NOT EXISTS idx_organizations_primary_locations ON organizations USING GIN (primary_locations);

-- Comments
COMMENT ON COLUMN organizations.org_size IS 'Organization size/type for eligibility matching';
COMMENT ON COLUMN organizations.annual_budget_range IS 'Annual budget range for sizing grants';
COMMENT ON COLUMN organizations.primary_locations IS 'Primary locations (state codes) for geographic matching';
COMMENT ON COLUMN organizations.service_areas IS 'Geographic areas where services are provided';
COMMENT ON COLUMN organizations.focus_categories IS 'Array of funding category codes of interest (matches FUNDING_CATEGORIES)';
COMMENT ON COLUMN organizations.min_grant_amount IS 'Minimum grant amount the org is interested in';
COMMENT ON COLUMN organizations.max_grant_amount IS 'Maximum grant amount the org can manage';
COMMENT ON COLUMN organizations.eligibility_notes IS 'Additional eligibility requirements or context';
COMMENT ON COLUMN organizations.auto_filter_enabled IS 'Automatically filter grants based on eligibility profile';


-- ============================================================================
-- Grant Recommendations View
-- ============================================================================
-- Create a view for recommended grants based on interactions and profile

CREATE OR REPLACE VIEW grant_recommendations AS
SELECT
    gi.org_id,
    gi.external_id,
    COUNT(*) FILTER (WHERE gi.interaction_type = 'saved') as save_count,
    COUNT(*) FILTER (WHERE gi.interaction_type = 'viewed') as view_count,
    COUNT(*) FILTER (WHERE gi.interaction_type = 'declined') as decline_count,
    COUNT(*) FILTER (WHERE gi.interaction_type = 'submitted') as submit_count,
    MAX(gi.created_at) as last_interaction,
    -- Simple recommendation score
    (
        COUNT(*) FILTER (WHERE gi.interaction_type = 'saved') * 3 +
        COUNT(*) FILTER (WHERE gi.interaction_type = 'submitted') * 5 +
        COUNT(*) FILTER (WHERE gi.interaction_type = 'viewed') * 1 -
        COUNT(*) FILTER (WHERE gi.interaction_type = 'declined') * 2
    ) as recommendation_score
FROM grant_interactions gi
GROUP BY gi.org_id, gi.external_id;

COMMENT ON VIEW grant_recommendations IS 'Aggregated grant interaction data for recommendation scoring';


-- ============================================================================
-- Function to calculate eligibility match score
-- ============================================================================
-- This function would calculate how well a grant matches an org's profile
-- For now, this is a placeholder - implementation would be in application code

CREATE OR REPLACE FUNCTION calculate_eligibility_score(
    org_id_param UUID,
    grant_category TEXT,
    grant_location TEXT,
    grant_amount NUMERIC
) RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    org_record RECORD;
BEGIN
    -- Get organization profile
    SELECT * INTO org_record FROM organizations WHERE id = org_id_param;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Check if auto-filter is enabled
    IF NOT org_record.auto_filter_enabled THEN
        RETURN 100; -- Return high score if auto-filter is disabled (show all)
    END IF;

    -- Category match
    IF grant_category = ANY(org_record.focus_categories) THEN
        score := score + 30;
    END IF;

    -- Location match (if applicable)
    IF grant_location IS NOT NULL AND grant_location = ANY(org_record.primary_locations) THEN
        score := score + 20;
    END IF;

    -- Amount match
    IF grant_amount IS NOT NULL THEN
        IF grant_amount >= COALESCE(org_record.min_grant_amount, 0) AND
           grant_amount <= COALESCE(org_record.max_grant_amount, 999999999) THEN
            score := score + 20;
        END IF;
    END IF;

    -- Base score for all grants
    score := score + 30;

    RETURN score;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_eligibility_score IS 'Calculates eligibility match score for a grant based on org profile';
