-- Update plan types to include 'starter' tier
-- Free: No AI features
-- Starter: Limited AI features
-- Pro: Full AI features
-- Enterprise: Full AI features (legacy, treated same as Pro)

-- Drop old constraint
ALTER TABLE public.organization_settings
DROP CONSTRAINT IF EXISTS organization_settings_plan_check;

-- Add new constraint with 'starter'
ALTER TABLE public.organization_settings
ADD CONSTRAINT organization_settings_plan_check
CHECK (plan_name IN ('free', 'starter', 'pro', 'enterprise'));

COMMENT ON COLUMN public.organization_settings.plan_name IS 'Subscription plan: free (no AI), starter (limited AI), pro (full AI), enterprise (full AI)';
