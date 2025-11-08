-- Create org_grants_saved table
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_org_id ON public.org_grants_saved(org_id);
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_user_id ON public.org_grants_saved(user_id);
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_external_id ON public.org_grants_saved(external_source, external_id);

-- Enable Row Level Security
ALTER TABLE public.org_grants_saved ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view saved grants for their organization
CREATE POLICY "Users can view org grants"
  ON public.org_grants_saved
  FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM public.organizations
      WHERE id = org_id
    )
  );

-- Policy: Users can insert grants for their organization
CREATE POLICY "Users can insert org grants"
  ON public.org_grants_saved
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.organizations
      WHERE id = org_id
    )
  );

-- Policy: Users can delete grants for their organization
CREATE POLICY "Users can delete org grants"
  ON public.org_grants_saved
  FOR DELETE
  USING (
    org_id IN (
      SELECT id FROM public.organizations
      WHERE id = org_id
    )
  );

-- Note: If you don't have an organizations table yet, replace the policies with:
-- USING (auth.uid() = user_id) for user-scoped access
-- or remove RLS temporarily for development
