-- Create integrations table for OAuth-based integrations
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type text NOT NULL, -- 'slack', 'google_calendar', 'microsoft_teams'
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  webhook_url text, -- For Teams incoming webhooks
  channel_id text, -- For Slack channel
  channel_name text,
  connected_by uuid REFERENCES auth.users(id),
  connected_at timestamptz DEFAULT now(),
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, integration_type)
);

-- Create webhooks table for custom webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret text, -- Optional signing secret
  events text[] NOT NULL DEFAULT ARRAY['grant.saved', 'grant.deadline_approaching', 'grant.deadline_passed'],
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_triggered_at timestamptz,
  total_deliveries integer DEFAULT 0,
  failed_deliveries integer DEFAULT 0
);

-- Create webhook delivery log table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  delivered_at timestamptz DEFAULT now(),
  error_message text
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_webhooks_org_id ON webhooks(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC);

-- Add RLS policies
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Integrations policies
CREATE POLICY "Users can view their org's integrations"
  ON integrations FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage integrations"
  ON integrations FOR ALL
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Webhooks policies
CREATE POLICY "Users can view their org's webhooks"
  ON webhooks FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage webhooks"
  ON webhooks FOR ALL
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Webhook deliveries policies
CREATE POLICY "Users can view their org's webhook deliveries"
  ON webhook_deliveries FOR SELECT
  USING (webhook_id IN (
    SELECT id FROM webhooks WHERE org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
