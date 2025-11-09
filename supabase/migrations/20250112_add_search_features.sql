-- Migration: Add Search Features
-- Description: Creates tables for recent searches, saved views, and grant interactions

-- ============================================================================
-- Recent Searches Table
-- ============================================================================
-- Stores user search history for quick access
CREATE TABLE IF NOT EXISTS recent_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Search parameters
    keyword TEXT,
    category TEXT,
    agency TEXT,
    status_posted BOOLEAN DEFAULT true,
    status_forecasted BOOLEAN DEFAULT true,
    due_in_days INTEGER,
    sort_by TEXT DEFAULT 'due_soon',

    -- Metadata
    search_count INTEGER DEFAULT 1, -- Number of times this search was used
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unique constraint: One entry per unique search query per user
    UNIQUE(org_id, user_id, keyword, category, agency, status_posted, status_forecasted, due_in_days, sort_by)
);

-- Index for faster lookups
CREATE INDEX idx_recent_searches_user ON recent_searches(user_id, org_id, last_used_at DESC);
CREATE INDEX idx_recent_searches_org ON recent_searches(org_id, last_used_at DESC);

-- RLS Policies for recent_searches
ALTER TABLE recent_searches ENABLE ROW LEVEL SECURITY;

-- Users can view their own organization's recent searches
CREATE POLICY "Users can view org recent searches"
    ON recent_searches FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM org_members WHERE user_id = auth.uid()
        )
    );

-- Users can create their own recent searches
CREATE POLICY "Users can create recent searches"
    ON recent_searches FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        org_id IN (
            SELECT org_id FROM org_members WHERE user_id = auth.uid()
        )
    );

-- Users can update their own recent searches
CREATE POLICY "Users can update own recent searches"
    ON recent_searches FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own recent searches
CREATE POLICY "Users can delete own recent searches"
    ON recent_searches FOR DELETE
    USING (user_id = auth.uid());


-- ============================================================================
-- Saved Views Table
-- ============================================================================
-- Stores named filter configurations that can be shared within org
CREATE TABLE IF NOT EXISTS saved_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- View configuration
    name TEXT NOT NULL,
    description TEXT,

    -- Filter parameters (same as recent_searches)
    keyword TEXT,
    category TEXT,
    agency TEXT,
    status_posted BOOLEAN DEFAULT true,
    status_forecasted BOOLEAN DEFAULT true,
    due_in_days INTEGER,
    sort_by TEXT DEFAULT 'due_soon',

    -- Sharing settings
    is_shared BOOLEAN DEFAULT false, -- If true, visible to all org members

    -- Metadata
    use_count INTEGER DEFAULT 0, -- Number of times this view was loaded
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure unique names per org
    UNIQUE(org_id, name)
);

-- Index for faster lookups
CREATE INDEX idx_saved_views_org ON saved_views(org_id, created_at DESC);
CREATE INDEX idx_saved_views_shared ON saved_views(org_id, is_shared) WHERE is_shared = true;

-- RLS Policies for saved_views
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved views and shared views in their org
CREATE POLICY "Users can view saved views"
    ON saved_views FOR SELECT
    USING (
        (created_by = auth.uid()) OR
        (is_shared = true AND org_id IN (
            SELECT org_id FROM org_members WHERE user_id = auth.uid()
        ))
    );

-- Users can create saved views in their org
CREATE POLICY "Users can create saved views"
    ON saved_views FOR INSERT
    WITH CHECK (
        created_by = auth.uid() AND
        org_id IN (
            SELECT org_id FROM org_members WHERE user_id = auth.uid()
        )
    );

-- Users can update their own saved views
CREATE POLICY "Users can update own saved views"
    ON saved_views FOR UPDATE
    USING (created_by = auth.uid());

-- Users can delete their own saved views
CREATE POLICY "Users can delete own saved views"
    ON saved_views FOR DELETE
    USING (created_by = auth.uid());


-- ============================================================================
-- Grant Interactions Table (for P2 recommendation engine)
-- ============================================================================
-- Tracks user interactions with grants for recommendation learning
CREATE TABLE IF NOT EXISTS grant_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Grant reference
    grant_id UUID REFERENCES org_grants_saved(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL, -- Grants.gov opportunity ID

    -- Interaction type
    interaction_type TEXT NOT NULL CHECK (interaction_type IN (
        'viewed',        -- User viewed grant details
        'saved',         -- User saved to pipeline
        'unsaved',       -- User removed from pipeline
        'submitted',     -- Grant was submitted
        'declined'       -- User explicitly marked as not interested
    )),

    -- Context (optional - for future use)
    context JSONB, -- Store additional context like search query, etc.

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_grant_interactions_user ON grant_interactions(user_id, org_id, created_at DESC);
CREATE INDEX idx_grant_interactions_org ON grant_interactions(org_id, created_at DESC);
CREATE INDEX idx_grant_interactions_external ON grant_interactions(external_id, interaction_type);

-- RLS Policies for grant_interactions
ALTER TABLE grant_interactions ENABLE ROW LEVEL SECURITY;

-- Users can view their org's interactions (for recommendations)
CREATE POLICY "Users can view org grant interactions"
    ON grant_interactions FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM org_members WHERE user_id = auth.uid()
        )
    );

-- Users can create interactions
CREATE POLICY "Users can create grant interactions"
    ON grant_interactions FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        org_id IN (
            SELECT org_id FROM org_members WHERE user_id = auth.uid()
        )
    );

-- No update or delete policies - interactions are immutable logs


-- ============================================================================
-- Functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for saved_views
CREATE TRIGGER update_saved_views_updated_at
    BEFORE UPDATE ON saved_views
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE recent_searches IS 'Stores user search history for quick access and suggestions';
COMMENT ON TABLE saved_views IS 'Named filter configurations that can be saved and shared within an organization';
COMMENT ON TABLE grant_interactions IS 'Tracks user interactions with grants for learning and recommendations';
