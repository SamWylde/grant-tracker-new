-- Backfill missing organization_settings for existing organizations
-- Some orgs may not have settings if they were created before the trigger was added

-- Insert missing organization_settings rows for any org that doesn't have one
INSERT INTO public.organization_settings (org_id)
SELECT o.id
FROM public.organizations o
LEFT JOIN public.organization_settings os ON o.id = os.org_id
WHERE os.org_id IS NULL
ON CONFLICT (org_id) DO NOTHING;

-- Log the number of rows that were backfilled
DO $$
DECLARE
  backfilled_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO backfilled_count
  FROM public.organizations o
  INNER JOIN public.organization_settings os ON o.id = os.org_id
  WHERE os.created_at > (NOW() - INTERVAL '1 minute');

  RAISE NOTICE 'Backfilled organization_settings for % organizations', backfilled_count;
END $$;

COMMENT ON TABLE public.organization_settings IS 'Settings for each organization. Each org should have exactly one row, automatically created by trigger.';
