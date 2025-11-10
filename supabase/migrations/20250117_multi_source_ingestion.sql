-- =====================================================
-- Multi-Source Grant Ingestion System
-- Created: 2025-01-17
-- Purpose: Support ingestion from multiple grant sources
--          with de-duplication, sync tracking, and alerts
-- =====================================================

-- =====================================================
-- 1. GRANT SOURCES TABLE
-- Define and configure different grant data sources
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grant_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_key TEXT UNIQUE NOT NULL, -- e.g., 'grants_gov', 'opengrants', 'ca_state_portal'
  source_name TEXT NOT NULL, -- Display name
  source_type TEXT NOT NULL, -- 'federal', 'state', 'private', 'custom'

  -- API configuration
  api_enabled BOOLEAN DEFAULT TRUE,
  api_base_url TEXT,
  api_key_required BOOLEAN DEFAULT FALSE,
  rate_limit_per_minute INTEGER,

  -- Sync configuration
  sync_enabled BOOLEAN DEFAULT TRUE,
  sync_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'manual'
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT grant_sources_type_check CHECK (source_type IN ('federal', 'state', 'private', 'custom')),
  CONSTRAINT grant_sources_sync_frequency_check CHECK (sync_frequency IN ('hourly', 'daily', 'weekly', 'manual'))
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_grant_sources_key ON public.grant_sources(source_key);
CREATE INDEX IF NOT EXISTS idx_grant_sources_type ON public.grant_sources(source_type);

-- =====================================================
-- 2. GRANTS CATALOG TABLE
-- Centralized catalog of ALL grants from ALL sources
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grants_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES public.grant_sources(id) ON DELETE CASCADE,

  -- Source identifiers
  source_key TEXT NOT NULL, -- Denormalized for performance
  external_id TEXT NOT NULL, -- ID from the source system

  -- Core grant data (normalized across sources)
  title TEXT NOT NULL,
  description TEXT,
  agency TEXT,
  opportunity_number TEXT,

  -- Financial info
  estimated_funding NUMERIC,
  award_floor NUMERIC,
  award_ceiling NUMERIC,
  expected_awards INTEGER,

  -- Categories and eligibility
  funding_category TEXT,
  eligibility_applicants TEXT[],
  cost_sharing_required BOOLEAN,

  -- Important dates
  posted_date TIMESTAMPTZ,
  open_date TIMESTAMPTZ,
  close_date TIMESTAMPTZ,

  -- Status
  opportunity_status TEXT, -- 'forecasted', 'posted', 'closed', 'archived'

  -- Additional structured data
  cfda_numbers TEXT[], -- Catalog of Federal Domestic Assistance numbers
  aln_codes TEXT[], -- Assistance Listing Numbers

  -- Links
  source_url TEXT,
  application_url TEXT,

  -- Content hash for de-duplication
  content_hash TEXT,

  -- Metadata
  first_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,

  -- Full-text search
  search_vector TSVECTOR,

  -- Constraints
  UNIQUE(source_id, external_id),
  CONSTRAINT grants_catalog_status_check CHECK (opportunity_status IN ('forecasted', 'posted', 'closed', 'archived'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_grants_catalog_source_key ON public.grants_catalog(source_key);
CREATE INDEX IF NOT EXISTS idx_grants_catalog_external_id ON public.grants_catalog(external_id);
CREATE INDEX IF NOT EXISTS idx_grants_catalog_close_date ON public.grants_catalog(close_date) WHERE close_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grants_catalog_status ON public.grants_catalog(opportunity_status);
CREATE INDEX IF NOT EXISTS idx_grants_catalog_active ON public.grants_catalog(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_grants_catalog_hash ON public.grants_catalog(content_hash);
CREATE INDEX IF NOT EXISTS idx_grants_catalog_search ON public.grants_catalog USING gin(search_vector);

-- Trigger to update search_vector
CREATE OR REPLACE FUNCTION update_grants_catalog_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.agency, '') || ' ' ||
    COALESCE(NEW.opportunity_number, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grants_catalog_search_vector_update ON public.grants_catalog;
CREATE TRIGGER grants_catalog_search_vector_update
  BEFORE INSERT OR UPDATE OF title, description, agency, opportunity_number
  ON public.grants_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_grants_catalog_search_vector();

-- =====================================================
-- 3. GRANT DUPLICATES TABLE
-- Track potential duplicates across sources
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grant_duplicates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Grant references
  primary_grant_id UUID NOT NULL REFERENCES public.grants_catalog(id) ON DELETE CASCADE,
  duplicate_grant_id UUID NOT NULL REFERENCES public.grants_catalog(id) ON DELETE CASCADE,

  -- Matching info
  match_score NUMERIC NOT NULL, -- 0.0 to 1.0
  match_method TEXT NOT NULL, -- 'title_hash', 'fuzzy_match', 'manual'

  -- Resolution
  is_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,

  -- Metadata
  detected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  UNIQUE(primary_grant_id, duplicate_grant_id),
  CONSTRAINT grant_duplicates_different_grants CHECK (primary_grant_id != duplicate_grant_id)
);

CREATE INDEX IF NOT EXISTS idx_grant_duplicates_primary ON public.grant_duplicates(primary_grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_duplicates_duplicate ON public.grant_duplicates(duplicate_grant_id);

-- =====================================================
-- 4. SYNC JOBS TABLE
-- Track synchronization operations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES public.grant_sources(id) ON DELETE CASCADE,

  -- Job info
  job_type TEXT NOT NULL DEFAULT 'full', -- 'full', 'incremental', 'single'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'

  -- Results
  grants_fetched INTEGER DEFAULT 0,
  grants_created INTEGER DEFAULT 0,
  grants_updated INTEGER DEFAULT 0,
  grants_skipped INTEGER DEFAULT 0,
  duplicates_found INTEGER DEFAULT 0,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT sync_jobs_type_check CHECK (job_type IN ('full', 'incremental', 'single')),
  CONSTRAINT sync_jobs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_jobs_source_id ON public.sync_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON public.sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON public.sync_jobs(created_at DESC);

-- =====================================================
-- 5. SAVED SEARCHES TABLE (enhanced from previous)
-- Already exists but ensuring it's compatible
-- =====================================================
-- This was created in 20250112_add_search_features.sql
-- We'll add a trigger to check for new grants matching saved searches

-- =====================================================
-- 6. GRANT MATCH NOTIFICATIONS TABLE
-- Track when new grants match saved searches
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grant_match_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_search_id UUID, -- Can be NULL if from alert rules
  grant_id UUID NOT NULL REFERENCES public.grants_catalog(id) ON DELETE CASCADE,

  -- Notification info
  match_score NUMERIC, -- How well it matched the search criteria
  notification_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,

  -- User interaction
  viewed BOOLEAN DEFAULT FALSE,
  viewed_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grant_match_notifications_user ON public.grant_match_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_grant_match_notifications_org ON public.grant_match_notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_match_notifications_search ON public.grant_match_notifications(saved_search_id);
CREATE INDEX IF NOT EXISTS idx_grant_match_notifications_grant ON public.grant_match_notifications(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_match_notifications_sent ON public.grant_match_notifications(notification_sent) WHERE notification_sent = FALSE;

-- =====================================================
-- 7. UPDATE org_grants_saved TO REFERENCE CATALOG
-- Add optional reference to catalog (for tracked grants)
-- =====================================================
ALTER TABLE public.org_grants_saved
  ADD COLUMN IF NOT EXISTS catalog_grant_id UUID REFERENCES public.grants_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_grants_saved_catalog ON public.org_grants_saved(catalog_grant_id);

-- =====================================================
-- 8. FUNCTIONS FOR DE-DUPLICATION
-- =====================================================

-- Function to generate content hash for de-duplication
CREATE OR REPLACE FUNCTION generate_grant_content_hash(
  p_title TEXT,
  p_agency TEXT,
  p_close_date TIMESTAMPTZ
)
RETURNS TEXT AS $$
BEGIN
  RETURN md5(
    LOWER(TRIM(p_title)) || '|' ||
    COALESCE(LOWER(TRIM(p_agency)), '') || '|' ||
    COALESCE(p_close_date::TEXT, '')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find potential duplicates for a grant
CREATE OR REPLACE FUNCTION find_potential_duplicates(p_grant_id UUID)
RETURNS TABLE (
  duplicate_id UUID,
  match_score NUMERIC,
  match_reason TEXT
) AS $$
DECLARE
  v_grant RECORD;
BEGIN
  -- Get the grant we're checking
  SELECT * INTO v_grant FROM public.grants_catalog WHERE id = p_grant_id;

  -- Find grants with same content hash (highest confidence)
  RETURN QUERY
  SELECT
    gc.id,
    1.0::NUMERIC as match_score,
    'identical_hash'::TEXT as match_reason
  FROM public.grants_catalog gc
  WHERE gc.content_hash = v_grant.content_hash
    AND gc.id != p_grant_id
    AND gc.is_active = TRUE;

  -- Find grants with very similar titles and same agency (medium confidence)
  RETURN QUERY
  SELECT
    gc.id,
    0.8::NUMERIC as match_score,
    'similar_title_agency'::TEXT as match_reason
  FROM public.grants_catalog gc
  WHERE gc.id != p_grant_id
    AND gc.is_active = TRUE
    AND gc.agency = v_grant.agency
    AND similarity(gc.title, v_grant.title) > 0.7
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. SEED DATA - Grant Sources
-- =====================================================

-- Grants.gov (Federal)
INSERT INTO public.grant_sources (
  source_key, source_name, source_type,
  api_enabled, api_base_url, api_key_required,
  rate_limit_per_minute, sync_enabled, sync_frequency
) VALUES (
  'grants_gov',
  'Grants.gov',
  'federal',
  TRUE,
  'https://api.grants.gov/v1/api',
  FALSE,
  60,
  TRUE,
  'daily'
) ON CONFLICT (source_key) DO NOTHING;

-- OpenGrants (Aggregator)
INSERT INTO public.grant_sources (
  source_key, source_name, source_type,
  api_enabled, api_base_url, api_key_required,
  rate_limit_per_minute, sync_enabled, sync_frequency
) VALUES (
  'opengrants',
  'OpenGrants',
  'federal',
  TRUE,
  'https://api.opengrants.io/v1',
  TRUE,
  30,
  FALSE, -- Disabled by default until API key configured
  'daily'
) ON CONFLICT (source_key) DO NOTHING;

-- California State Portal
INSERT INTO public.grant_sources (
  source_key, source_name, source_type,
  api_enabled, sync_enabled, sync_frequency
) VALUES (
  'ca_state_portal',
  'California State Grants',
  'state',
  FALSE, -- Manual curation
  TRUE,
  'weekly'
) ON CONFLICT (source_key) DO NOTHING;

-- Custom/Manual Entry
INSERT INTO public.grant_sources (
  source_key, source_name, source_type,
  api_enabled, sync_enabled
) VALUES (
  'custom',
  'Custom/Manual Entry',
  'custom',
  FALSE,
  FALSE
) ON CONFLICT (source_key) DO NOTHING;

-- =====================================================
-- 10. ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE public.grant_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grants_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_duplicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_match_notifications ENABLE ROW LEVEL SECURITY;

-- Grant Sources: Public read, admin write
DROP POLICY IF EXISTS "Anyone can view grant sources" ON public.grant_sources;
CREATE POLICY "Anyone can view grant sources"
  ON public.grant_sources FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Service role can manage sources" ON public.grant_sources;
CREATE POLICY "Service role can manage sources"
  ON public.grant_sources FOR ALL
  USING (auth.role() = 'service_role');

-- Grants Catalog: Public read for active grants
DROP POLICY IF EXISTS "Anyone can view active grants" ON public.grants_catalog;
CREATE POLICY "Anyone can view active grants"
  ON public.grants_catalog FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Service role can manage catalog" ON public.grants_catalog;
CREATE POLICY "Service role can manage catalog"
  ON public.grants_catalog FOR ALL
  USING (auth.role() = 'service_role');

-- Grant Duplicates: Admins can view and manage
DROP POLICY IF EXISTS "Org admins can view duplicates" ON public.grant_duplicates;
CREATE POLICY "Org admins can view duplicates"
  ON public.grant_duplicates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role can manage duplicates" ON public.grant_duplicates;
CREATE POLICY "Service role can manage duplicates"
  ON public.grant_duplicates FOR ALL
  USING (auth.role() = 'service_role');

-- Sync Jobs: Service role only
DROP POLICY IF EXISTS "Service role can manage sync jobs" ON public.sync_jobs;
CREATE POLICY "Service role can manage sync jobs"
  ON public.sync_jobs FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can view sync jobs" ON public.sync_jobs;
CREATE POLICY "Admins can view sync jobs"
  ON public.sync_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Grant Match Notifications: Users see their own
DROP POLICY IF EXISTS "Users can view their notifications" ON public.grant_match_notifications;
CREATE POLICY "Users can view their notifications"
  ON public.grant_match_notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their notifications" ON public.grant_match_notifications;
CREATE POLICY "Users can update their notifications"
  ON public.grant_match_notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can create notifications" ON public.grant_match_notifications;
CREATE POLICY "Service role can create notifications"
  ON public.grant_match_notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 11. TRIGGER TO AUTO-UPDATE last_updated_at
-- =====================================================

DROP TRIGGER IF EXISTS update_grant_sources_updated_at ON public.grant_sources;
CREATE TRIGGER update_grant_sources_updated_at
  BEFORE UPDATE ON public.grant_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grants catalog last_updated_at trigger
CREATE OR REPLACE FUNCTION update_grants_catalog_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_grants_catalog_timestamp ON public.grants_catalog;
CREATE TRIGGER update_grants_catalog_timestamp
  BEFORE UPDATE ON public.grants_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_grants_catalog_timestamp();
