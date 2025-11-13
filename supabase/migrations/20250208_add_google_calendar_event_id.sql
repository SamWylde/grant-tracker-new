-- Migration: Add Google Calendar Event ID to org_grants_saved
-- Description: Adds google_calendar_event_id column to track associated calendar events

-- Add google_calendar_event_id column to store the Google Calendar event ID
ALTER TABLE org_grants_saved
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Create index for faster lookups when syncing calendar events
CREATE INDEX IF NOT EXISTS idx_org_grants_saved_calendar_event
ON org_grants_saved(google_calendar_event_id)
WHERE google_calendar_event_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN org_grants_saved.google_calendar_event_id IS 'Google Calendar event ID for deadline synchronization';
