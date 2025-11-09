-- =====================================================
-- Settings & Organization Schema Migration
-- Created: 2025-01-08
-- Purpose: Complete schema for user profiles, organizations,
--          teams, settings, and permissions
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  primary_state TEXT,
  focus_areas TEXT[], -- Array of focus areas (chips)
  logo_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT organizations_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- =====================================================
-- 2. USER PROFILES TABLE
-- Extends Supabase auth.users with additional fields
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile fields
  full_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'America/New_York',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 3. ORG MEMBERS TABLE (with roles)
-- Links users to organizations with role-based permissions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role: 'admin' or 'contributor'
  role TEXT NOT NULL DEFAULT 'contributor',

  -- Metadata
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  invited_by UUID REFERENCES auth.users(id),

  -- Constraints
  UNIQUE(org_id, user_id),
  CONSTRAINT org_members_role_check CHECK (role IN ('admin', 'contributor'))
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members(org_id);

-- =====================================================
-- 4. TEAM INVITATIONS TABLE
-- Tracks pending invites to organizations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor',

  -- Status tracking
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT team_invitations_role_check CHECK (role IN ('admin', 'contributor')),
  CONSTRAINT team_invitations_org_email_unique UNIQUE(org_id, email)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_org_id ON public.team_invitations(org_id);

-- =====================================================
-- 5. USER PREFERENCES TABLE
-- Per-user notification and email preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email preferences
  weekly_summary_emails BOOLEAN DEFAULT TRUE,
  product_updates BOOLEAN DEFAULT TRUE,

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 6. ORGANIZATION SETTINGS TABLE
-- Per-org notification and integration settings
-- =====================================================
CREATE TABLE IF NOT EXISTS public.organization_settings (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Email deadline reminders (days before)
  deadline_reminders_30d BOOLEAN DEFAULT TRUE,
  deadline_reminders_14d BOOLEAN DEFAULT TRUE,
  deadline_reminders_7d BOOLEAN DEFAULT TRUE,
  deadline_reminders_3d BOOLEAN DEFAULT TRUE,
  deadline_reminders_1d BOOLEAN DEFAULT TRUE,
  deadline_reminders_0d BOOLEAN DEFAULT TRUE,

  -- Task reminders
  daily_task_emails BOOLEAN DEFAULT TRUE,

  -- Calendar integration
  ics_token UUID DEFAULT uuid_generate_v4(),
  google_calendar_connected BOOLEAN DEFAULT FALSE,
  google_calendar_token TEXT, -- Encrypted

  -- Billing
  plan_name TEXT DEFAULT 'free',
  plan_status TEXT DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  next_renewal_at TIMESTAMPTZ,

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT organization_settings_plan_check CHECK (plan_name IN ('free', 'pro', 'enterprise'))
);

-- =====================================================
-- 7. ORG GRANTS SAVED TABLE (already exists, recreating for completeness)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.org_grants_saved (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Grant data
  external_source TEXT DEFAULT 'grants.gov',
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  agency TEXT,
  aln TEXT,
  open_date TIMESTAMPTZ,
  close_date TIMESTAMPTZ,

  -- Metadata
  saved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  UNIQUE(org_id, external_source, external_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_org_id ON public.org_grants_saved(org_id);
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_user_id ON public.org_grants_saved(user_id);

-- =====================================================
-- 8. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_settings_updated_at ON public.organization_settings;
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create user profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to auto-create organization settings
CREATE OR REPLACE FUNCTION handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_settings (org_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create organization settings
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_organization();

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_grants_saved ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ORGANIZATIONS POLICIES
-- =====================================================

-- Users can view organizations they're members of
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
CREATE POLICY "Users can view their organizations"
  ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Admins can update their organizations
DROP POLICY IF EXISTS "Admins can update their organizations" ON public.organizations;
CREATE POLICY "Admins can update their organizations"
  ON public.organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Anyone can create an organization (they become admin automatically)
DROP POLICY IF EXISTS "Anyone can create organizations" ON public.organizations;
CREATE POLICY "Anyone can create organizations"
  ON public.organizations
  FOR INSERT
  WITH CHECK (true);

-- Admins can delete their organizations
DROP POLICY IF EXISTS "Admins can delete their organizations" ON public.organizations;
CREATE POLICY "Admins can delete their organizations"
  ON public.organizations
  FOR DELETE
  USING (
    id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- USER PROFILES POLICIES
-- =====================================================

-- Users can view all user profiles (for team listings)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
CREATE POLICY "Users can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (true);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid());

-- Auto-insert on signup (handled by trigger)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- =====================================================
-- ORG MEMBERS POLICIES
-- =====================================================

-- Users can view members of their organizations
DROP POLICY IF EXISTS "Users can view org members" ON public.org_members;
CREATE POLICY "Users can view org members"
  ON public.org_members
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Admins can add members
DROP POLICY IF EXISTS "Admins can add members" ON public.org_members;
CREATE POLICY "Admins can add members"
  ON public.org_members
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update member roles
DROP POLICY IF EXISTS "Admins can update member roles" ON public.org_members;
CREATE POLICY "Admins can update member roles"
  ON public.org_members
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can remove members
DROP POLICY IF EXISTS "Admins can remove members" ON public.org_members;
CREATE POLICY "Admins can remove members"
  ON public.org_members
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- TEAM INVITATIONS POLICIES
-- =====================================================

-- Users can view invitations for their organizations
DROP POLICY IF EXISTS "Users can view org invitations" ON public.team_invitations;
CREATE POLICY "Users can view org invitations"
  ON public.team_invitations
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Admins can create invitations
DROP POLICY IF EXISTS "Admins can create invitations" ON public.team_invitations;
CREATE POLICY "Admins can create invitations"
  ON public.team_invitations
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update/revoke invitations
DROP POLICY IF EXISTS "Admins can update invitations" ON public.team_invitations;
CREATE POLICY "Admins can update invitations"
  ON public.team_invitations
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete invitations
DROP POLICY IF EXISTS "Admins can delete invitations" ON public.team_invitations;
CREATE POLICY "Admins can delete invitations"
  ON public.team_invitations
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- USER PREFERENCES POLICIES
-- =====================================================

-- Users can view and update their own preferences
DROP POLICY IF EXISTS "Users can manage own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage own preferences"
  ON public.user_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- ORGANIZATION SETTINGS POLICIES
-- =====================================================

-- Members can view their org settings
DROP POLICY IF EXISTS "Members can view org settings" ON public.organization_settings;
CREATE POLICY "Members can view org settings"
  ON public.organization_settings
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Admins can update org settings
DROP POLICY IF EXISTS "Admins can update org settings" ON public.organization_settings;
CREATE POLICY "Admins can update org settings"
  ON public.organization_settings
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Auto-insert on org creation (handled by trigger)
DROP POLICY IF EXISTS "Auto-insert org settings" ON public.organization_settings;
CREATE POLICY "Auto-insert org settings"
  ON public.organization_settings
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- ORG GRANTS SAVED POLICIES
-- =====================================================

-- Members can view grants for their organizations
DROP POLICY IF EXISTS "Members can view org grants" ON public.org_grants_saved;
CREATE POLICY "Members can view org grants"
  ON public.org_grants_saved
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Members can save grants for their organizations
DROP POLICY IF EXISTS "Members can save grants" ON public.org_grants_saved;
CREATE POLICY "Members can save grants"
  ON public.org_grants_saved
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Members can delete grants from their organizations
DROP POLICY IF EXISTS "Members can delete grants" ON public.org_grants_saved;
CREATE POLICY "Members can delete grants"
  ON public.org_grants_saved
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 10. SEED DATA FOR DEVELOPMENT
-- =====================================================

-- Insert demo organization (only if not exists)
INSERT INTO public.organizations (id, name, slug, primary_state, focus_areas)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Organization',
  'demo-org',
  'California',
  ARRAY['Education', 'Environment', 'Healthcare']
)
ON CONFLICT (id) DO NOTHING;

-- Note: User seeding will depend on Supabase auth setup
-- For development, create a user via Supabase dashboard, then add to org_members manually
