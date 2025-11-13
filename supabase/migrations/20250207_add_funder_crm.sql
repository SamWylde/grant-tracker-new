-- Migration: Add Funder & Contact CRM System
-- Description: Creates funders, contacts, and funder_interactions tables with proper relationships

-- ============================================================================
-- Funders Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS funders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Funder details
  name TEXT NOT NULL,
  website TEXT,
  description TEXT,
  agency_code TEXT,
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  UNIQUE(org_id, name)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_funders_org_id ON funders(org_id);
CREATE INDEX IF NOT EXISTS idx_funders_name ON funders(org_id, name);
CREATE INDEX IF NOT EXISTS idx_funders_agency_code ON funders(agency_code);

-- RLS Policies
ALTER TABLE funders ENABLE ROW LEVEL SECURITY;

-- Users can view funders in their organization
CREATE POLICY funders_select ON funders
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert funders in their organization
CREATE POLICY funders_insert ON funders
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Users can update funders in their organization
CREATE POLICY funders_update ON funders
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Users can delete funders in their organization
CREATE POLICY funders_delete ON funders
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE funders IS 'Organizations that provide grants (funding agencies)';
COMMENT ON COLUMN funders.name IS 'Name of the funding organization';
COMMENT ON COLUMN funders.website IS 'Official website URL';
COMMENT ON COLUMN funders.agency_code IS 'Government agency code if applicable';
COMMENT ON COLUMN funders.notes IS 'Internal notes about this funder';

-- ============================================================================
-- Contacts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  funder_id UUID NOT NULL REFERENCES funders(id) ON DELETE CASCADE,

  -- Contact details
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_funder_id ON contacts(funder_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- RLS Policies
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Users can view contacts in their organization
CREATE POLICY contacts_select ON contacts
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert contacts in their organization
CREATE POLICY contacts_insert ON contacts
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Users can update contacts in their organization
CREATE POLICY contacts_update ON contacts
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Users can delete contacts in their organization
CREATE POLICY contacts_delete ON contacts
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE contacts IS 'Contact persons at funding organizations';
COMMENT ON COLUMN contacts.name IS 'Full name of the contact person';
COMMENT ON COLUMN contacts.email IS 'Email address';
COMMENT ON COLUMN contacts.phone IS 'Phone number';
COMMENT ON COLUMN contacts.title IS 'Job title or role';
COMMENT ON COLUMN contacts.notes IS 'Internal notes about this contact';

-- ============================================================================
-- Funder Interactions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS funder_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  funder_id UUID NOT NULL REFERENCES funders(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Interaction details
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'email', 'phone_call', 'meeting', 'conference', 'site_visit', 'other'
  )),
  interaction_date TIMESTAMPTZ NOT NULL,
  notes TEXT NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_funder_interactions_org_id ON funder_interactions(org_id);
CREATE INDEX IF NOT EXISTS idx_funder_interactions_funder_id ON funder_interactions(funder_id);
CREATE INDEX IF NOT EXISTS idx_funder_interactions_contact_id ON funder_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_funder_interactions_user_id ON funder_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_funder_interactions_date ON funder_interactions(interaction_date DESC);

-- RLS Policies
ALTER TABLE funder_interactions ENABLE ROW LEVEL SECURITY;

-- Users can view interactions in their organization
CREATE POLICY funder_interactions_select ON funder_interactions
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert interactions in their organization
CREATE POLICY funder_interactions_insert ON funder_interactions
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Users can update their own interactions
CREATE POLICY funder_interactions_update ON funder_interactions
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own interactions
CREATE POLICY funder_interactions_delete ON funder_interactions
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE funder_interactions IS 'Log of interactions with funders and their contacts';
COMMENT ON COLUMN funder_interactions.interaction_type IS 'Type of interaction (email, phone_call, meeting, etc.)';
COMMENT ON COLUMN funder_interactions.interaction_date IS 'When the interaction occurred';
COMMENT ON COLUMN funder_interactions.notes IS 'Details about the interaction';

-- ============================================================================
-- Add funder_id to org_grants_saved
-- ============================================================================

-- Add funder_id foreign key to grants
ALTER TABLE org_grants_saved
ADD COLUMN IF NOT EXISTS funder_id UUID REFERENCES funders(id) ON DELETE SET NULL;

-- Create index for funder_id
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_funder_id ON org_grants_saved(funder_id);

-- Comments
COMMENT ON COLUMN org_grants_saved.funder_id IS 'Reference to the funder organization';

-- ============================================================================
-- Function to auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_funders_updated_at ON funders;
CREATE TRIGGER update_funders_updated_at
  BEFORE UPDATE ON funders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migrate existing agency strings to funders
-- ============================================================================

-- Create funders from unique agency names in org_grants_saved
INSERT INTO funders (org_id, name, agency_code)
SELECT DISTINCT
  org_id,
  agency,
  agency
FROM org_grants_saved
WHERE agency IS NOT NULL
  AND agency != ''
  AND NOT EXISTS (
    SELECT 1 FROM funders f
    WHERE f.org_id = org_grants_saved.org_id
    AND f.name = org_grants_saved.agency
  )
ORDER BY org_id, agency;

-- Update grants to link to their funders
UPDATE org_grants_saved
SET funder_id = (
  SELECT f.id
  FROM funders f
  WHERE f.org_id = org_grants_saved.org_id
    AND f.name = org_grants_saved.agency
)
WHERE agency IS NOT NULL
  AND agency != ''
  AND funder_id IS NULL;
