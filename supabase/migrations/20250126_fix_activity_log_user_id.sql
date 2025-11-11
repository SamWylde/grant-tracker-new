-- Migration: Fix activity log user_id constraint
-- Issue: When API updates grants using service role, auth.uid() returns NULL
-- Solution: Make user_id nullable and allow system-generated activities

-- Make user_id nullable
ALTER TABLE grant_activity_log
  ALTER COLUMN user_id DROP NOT NULL;

-- Update the constraint to allow NULL user_id (for system activities)
COMMENT ON COLUMN grant_activity_log.user_id IS 'User who performed the action. NULL for system-generated activities.';
