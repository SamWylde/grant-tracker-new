-- Create table to store OAuth state tokens for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_state_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'google', 'microsoft', 'slack', etc.
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_oauth_state_tokens_state_token ON oauth_state_tokens(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_state_tokens_expires_at ON oauth_state_tokens(expires_at);

-- Add function to clean up expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_state_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM oauth_state_tokens
  WHERE expires_at < now() OR (used = true AND created_at < now() - interval '1 hour');
END;
$$;

-- Create a scheduled job to clean up expired tokens (if pg_cron is available)
-- This can be run manually or via a cron job if pg_cron is not installed
-- SELECT cron.schedule('cleanup-oauth-tokens', '0 * * * *', 'SELECT cleanup_expired_oauth_state_tokens()');
