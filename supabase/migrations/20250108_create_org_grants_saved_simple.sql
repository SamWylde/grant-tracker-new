-- Create org_grants_saved table (SIMPLIFIED VERSION)
-- This version disables RLS for v1 development. For production, enable proper RLS.

CREATE TABLE IF NOT EXISTS public.org_grants_saved (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  external_source TEXT NOT NULL DEFAULT 'grants.gov',
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  agency TEXT,
  aln TEXT,
  open_date TIMESTAMPTZ,
  close_date TIMESTAMPTZ,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate saves of the same grant per org
  UNIQUE(org_id, external_source, external_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_org_id ON public.org_grants_saved(org_id);
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_user_id ON public.org_grants_saved(user_id);
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_external_id ON public.org_grants_saved(external_source, external_id);

-- Disable RLS for v1 (enable and add proper policies in production)
ALTER TABLE public.org_grants_saved DISABLE ROW LEVEL SECURITY;

-- Optional: If you want basic RLS, uncomment these lines:
-- ALTER TABLE public.org_grants_saved ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Allow all operations for development"
--   ON public.org_grants_saved
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);
