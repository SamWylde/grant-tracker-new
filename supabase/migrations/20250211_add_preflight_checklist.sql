-- =====================================================
-- Pre-Flight Checklist Migration
-- Created: 2025-02-11
-- Purpose: Add database tables for pre-flight checklist feature
--          Includes AI-generated checklist items from NOFO analysis
-- =====================================================

-- =====================================================
-- 1. GRANT PRE-FLIGHT CHECKLISTS TABLE
-- Store pre-flight checklist templates per grant
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grant_preflight_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Grant reference
  grant_id UUID NOT NULL REFERENCES public.org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Checklist metadata
  title TEXT NOT NULL DEFAULT 'Pre-Flight Checklist',
  description TEXT,

  -- AI generation details
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_summary_id UUID REFERENCES public.grant_ai_summaries(id) ON DELETE SET NULL,
  generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
  generation_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  generated_at TIMESTAMPTZ,

  -- Constraint: One checklist per grant
  UNIQUE(grant_id)
);

-- =====================================================
-- 2. PREFLIGHT CHECKLIST ITEMS TABLE
-- Individual checklist items with completion tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS public.preflight_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent checklist
  checklist_id UUID NOT NULL REFERENCES public.grant_preflight_checklists(id) ON DELETE CASCADE,

  -- Item details
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'eligibility',           -- Eligibility verification items
    'match_requirements',    -- Cost sharing/match requirements
    'required_attachments',  -- Required documents and attachments
    'deadlines',            -- LOI and application deadlines
    'compliance',           -- Compliance and regulatory requirements
    'budget',               -- Budget preparation items
    'custom'                -- Custom items from NOFO analysis
  )),

  -- Priority and ordering
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  position INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT true,

  -- Completion tracking
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Notes and context
  notes TEXT,
  source_text TEXT,  -- Original text from NOFO that generated this item

  -- AI metadata
  ai_generated BOOLEAN DEFAULT FALSE,
  confidence_score NUMERIC(3, 2), -- AI confidence score (0.00-1.00)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 3. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_preflight_checklists_grant ON public.grant_preflight_checklists(grant_id);
CREATE INDEX IF NOT EXISTS idx_preflight_checklists_org ON public.grant_preflight_checklists(org_id);
CREATE INDEX IF NOT EXISTS idx_preflight_checklists_status ON public.grant_preflight_checklists(generation_status);

CREATE INDEX IF NOT EXISTS idx_preflight_items_checklist ON public.preflight_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_preflight_items_category ON public.preflight_checklist_items(category);
CREATE INDEX IF NOT EXISTS idx_preflight_items_completed ON public.preflight_checklist_items(completed);
CREATE INDEX IF NOT EXISTS idx_preflight_items_position ON public.preflight_checklist_items(checklist_id, position);

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp for checklists
CREATE OR REPLACE FUNCTION update_preflight_checklist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER preflight_checklist_updated_at
  BEFORE UPDATE ON public.grant_preflight_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_preflight_checklist_timestamp();

-- Auto-update updated_at timestamp and track completion for items
CREATE OR REPLACE FUNCTION update_preflight_item_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Track completion
  IF NEW.completed = true AND OLD.completed = false THEN
    NEW.completed_at = NOW();
    NEW.completed_by = auth.uid();
  ELSIF NEW.completed = false AND OLD.completed = true THEN
    NEW.completed_at = NULL;
    NEW.completed_by = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER preflight_item_updated_at
  BEFORE UPDATE ON public.preflight_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_preflight_item_timestamp();

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.grant_preflight_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preflight_checklist_items ENABLE ROW LEVEL SECURITY;

-- Checklists: Org members can view/modify their org's checklists
DROP POLICY IF EXISTS "Org members can view checklists" ON public.grant_preflight_checklists;
CREATE POLICY "Org members can view checklists"
  ON public.grant_preflight_checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = grant_preflight_checklists.org_id
        AND org_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can insert checklists" ON public.grant_preflight_checklists;
CREATE POLICY "Org members can insert checklists"
  ON public.grant_preflight_checklists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = grant_preflight_checklists.org_id
        AND org_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can update checklists" ON public.grant_preflight_checklists;
CREATE POLICY "Org members can update checklists"
  ON public.grant_preflight_checklists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = grant_preflight_checklists.org_id
        AND org_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can delete checklists" ON public.grant_preflight_checklists;
CREATE POLICY "Org members can delete checklists"
  ON public.grant_preflight_checklists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = grant_preflight_checklists.org_id
        AND org_members.user_id = auth.uid()
    )
  );

-- Service role has full access
DROP POLICY IF EXISTS "Service role can manage checklists" ON public.grant_preflight_checklists;
CREATE POLICY "Service role can manage checklists"
  ON public.grant_preflight_checklists FOR ALL
  USING (auth.role() = 'service_role');

-- Checklist Items: Org members can view/modify items in their org's checklists
DROP POLICY IF EXISTS "Org members can view checklist items" ON public.preflight_checklist_items;
CREATE POLICY "Org members can view checklist items"
  ON public.preflight_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_preflight_checklists
      JOIN public.org_members ON org_members.org_id = grant_preflight_checklists.org_id
      WHERE grant_preflight_checklists.id = preflight_checklist_items.checklist_id
        AND org_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can insert checklist items" ON public.preflight_checklist_items;
CREATE POLICY "Org members can insert checklist items"
  ON public.preflight_checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grant_preflight_checklists
      JOIN public.org_members ON org_members.org_id = grant_preflight_checklists.org_id
      WHERE grant_preflight_checklists.id = preflight_checklist_items.checklist_id
        AND org_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can update checklist items" ON public.preflight_checklist_items;
CREATE POLICY "Org members can update checklist items"
  ON public.preflight_checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_preflight_checklists
      JOIN public.org_members ON org_members.org_id = grant_preflight_checklists.org_id
      WHERE grant_preflight_checklists.id = preflight_checklist_items.checklist_id
        AND org_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can delete checklist items" ON public.preflight_checklist_items;
CREATE POLICY "Org members can delete checklist items"
  ON public.preflight_checklist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_preflight_checklists
      JOIN public.org_members ON org_members.org_id = grant_preflight_checklists.org_id
      WHERE grant_preflight_checklists.id = preflight_checklist_items.checklist_id
        AND org_members.user_id = auth.uid()
    )
  );

-- Service role has full access
DROP POLICY IF EXISTS "Service role can manage checklist items" ON public.preflight_checklist_items;
CREATE POLICY "Service role can manage checklist items"
  ON public.preflight_checklist_items FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to get checklist completion statistics
CREATE OR REPLACE FUNCTION get_checklist_stats(p_checklist_id UUID)
RETURNS TABLE (
  total_items INTEGER,
  completed_items INTEGER,
  required_items INTEGER,
  required_completed INTEGER,
  completion_percentage NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_items,
    COUNT(*) FILTER (WHERE completed = true)::INTEGER AS completed_items,
    COUNT(*) FILTER (WHERE is_required = true)::INTEGER AS required_items,
    COUNT(*) FILTER (WHERE is_required = true AND completed = true)::INTEGER AS required_completed,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE completed = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
    END AS completion_percentage
  FROM public.preflight_checklist_items
  WHERE checklist_id = p_checklist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_checklist_stats(UUID) TO authenticated;

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON TABLE public.grant_preflight_checklists IS 'Pre-flight checklists for grants - generated from NOFO analysis';
COMMENT ON TABLE public.preflight_checklist_items IS 'Individual checklist items with completion tracking';
COMMENT ON COLUMN public.preflight_checklist_items.category IS 'Category: eligibility, match_requirements, required_attachments, deadlines, compliance, budget, custom';
COMMENT ON COLUMN public.preflight_checklist_items.source_text IS 'Original NOFO text that generated this checklist item';
COMMENT ON FUNCTION get_checklist_stats IS 'Calculate completion statistics for a checklist';
