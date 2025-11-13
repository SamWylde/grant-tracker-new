-- =====================================================
-- ADD LOI DEADLINE FIELD TO GRANTS
-- =====================================================
-- Add Letter of Intent (LOI) deadline field to org_grants_saved table
-- This allows tracking of LOI deadlines separate from application deadlines

-- Add loi_deadline column to org_grants_saved table
ALTER TABLE public.org_grants_saved
  ADD COLUMN IF NOT EXISTS loi_deadline TIMESTAMPTZ;

-- Add index for faster querying by LOI deadline
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_loi_deadline
  ON public.org_grants_saved(loi_deadline)
  WHERE loi_deadline IS NOT NULL;

-- Add loi_deadline to grant_ai_summaries table for AI extraction
ALTER TABLE public.grant_ai_summaries
  ADD COLUMN IF NOT EXISTS loi_deadline DATE;

-- Add index for AI summaries LOI deadline
CREATE INDEX IF NOT EXISTS idx_grant_ai_summaries_loi_deadline
  ON public.grant_ai_summaries(loi_deadline)
  WHERE loi_deadline IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.org_grants_saved.loi_deadline IS 'Letter of Intent (LOI) deadline - often comes before the full application deadline';
COMMENT ON COLUMN public.grant_ai_summaries.loi_deadline IS 'AI-extracted Letter of Intent deadline from NOFO';
