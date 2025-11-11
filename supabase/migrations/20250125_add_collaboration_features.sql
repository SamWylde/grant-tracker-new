-- =====================================================
-- Collaboration Features Migration
-- Created: 2025-01-25
-- Purpose: Add threaded comments, @mentions, and activity streams
--          for grants and tasks
-- =====================================================

-- =====================================================
-- 1. GRANT COMMENTS TABLE
-- Threaded comments on grants
-- =====================================================
CREATE TABLE IF NOT EXISTS public.grant_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  grant_id UUID NOT NULL REFERENCES public.org_grants_saved(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Threading support
  parent_comment_id UUID REFERENCES public.grant_comments(id) ON DELETE CASCADE,
  thread_id UUID, -- Root comment ID for efficient thread queries

  -- Content
  content TEXT NOT NULL,
  content_html TEXT, -- Rendered HTML with @mentions highlighted

  -- Mentions
  mentioned_user_ids UUID[], -- Array of user IDs mentioned in comment

  -- Status
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 10000)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grant_comments_grant ON public.grant_comments(grant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grant_comments_org ON public.grant_comments(org_id);
CREATE INDEX IF NOT EXISTS idx_grant_comments_user ON public.grant_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_grant_comments_parent ON public.grant_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_grant_comments_thread ON public.grant_comments(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_grant_comments_mentions ON public.grant_comments USING GIN (mentioned_user_ids);

-- Comments
COMMENT ON TABLE public.grant_comments IS 'Threaded comments and discussions on saved grants';
COMMENT ON COLUMN public.grant_comments.thread_id IS 'ID of the root comment in the thread for efficient querying';
COMMENT ON COLUMN public.grant_comments.mentioned_user_ids IS 'Array of user IDs mentioned with @ in the comment';

-- =====================================================
-- 2. TASK COMMENTS TABLE
-- Threaded comments on tasks
-- =====================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  task_id UUID NOT NULL REFERENCES public.grant_tasks(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Threading support
  parent_comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
  thread_id UUID, -- Root comment ID

  -- Content
  content TEXT NOT NULL,
  content_html TEXT,

  -- Mentions
  mentioned_user_ids UUID[],

  -- Status
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 10000)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_comments_org ON public.task_comments(org_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user ON public.task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_parent ON public.task_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_thread ON public.task_comments(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_task_comments_mentions ON public.task_comments USING GIN (mentioned_user_ids);

-- Comments
COMMENT ON TABLE public.task_comments IS 'Threaded comments and discussions on grant tasks';

-- =====================================================
-- 3. COMMENT REACTIONS TABLE
-- Optional: Allow users to react to comments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference (polymorphic - either grant or task comment)
  grant_comment_id UUID REFERENCES public.grant_comments(id) ON DELETE CASCADE,
  task_comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,

  -- User
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Reaction type
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'helpful', 'agree', 'disagree')),

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CHECK (
    (grant_comment_id IS NOT NULL AND task_comment_id IS NULL) OR
    (grant_comment_id IS NULL AND task_comment_id IS NOT NULL)
  ),
  UNIQUE(grant_comment_id, user_id, reaction_type),
  UNIQUE(task_comment_id, user_id, reaction_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comment_reactions_grant_comment ON public.comment_reactions(grant_comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_task_comment ON public.comment_reactions(task_comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON public.comment_reactions(user_id);

-- =====================================================
-- 4. MENTION NOTIFICATIONS TABLE
-- Track @mention notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mention_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Target user (who was mentioned)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Source (who mentioned them)
  mentioned_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Context (polymorphic - grant comment or task comment)
  grant_comment_id UUID REFERENCES public.grant_comments(id) ON DELETE CASCADE,
  task_comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,

  -- Context info for display
  context_type TEXT NOT NULL CHECK (context_type IN ('grant_comment', 'task_comment')),
  context_title TEXT, -- Grant title or task title

  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CHECK (
    (grant_comment_id IS NOT NULL AND task_comment_id IS NULL AND context_type = 'grant_comment') OR
    (grant_comment_id IS NULL AND task_comment_id IS NOT NULL AND context_type = 'task_comment')
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mention_notifications_user ON public.mention_notifications(user_id, created_at DESC) WHERE NOT dismissed;
CREATE INDEX IF NOT EXISTS idx_mention_notifications_org ON public.mention_notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_mention_notifications_unread ON public.mention_notifications(user_id, read) WHERE NOT read AND NOT dismissed;

-- =====================================================
-- 5. ACTIVITY STREAM VIEW
-- Combined view of recent activity (comments, mentions, updates)
-- =====================================================
CREATE OR REPLACE VIEW public.activity_stream AS
-- Grant comments
SELECT
  'grant_comment' AS activity_type,
  gc.id AS activity_id,
  gc.org_id,
  gc.user_id,
  gc.grant_id AS related_grant_id,
  NULL::UUID AS related_task_id,
  gc.content,
  gc.parent_comment_id,
  gc.mentioned_user_ids,
  gc.created_at,
  u.email AS user_email,
  om.full_name AS user_name,
  ogs.title AS grant_title,
  NULL AS task_title
FROM public.grant_comments gc
JOIN auth.users u ON gc.user_id = u.id
LEFT JOIN public.org_members om ON gc.user_id = om.user_id AND gc.org_id = om.org_id
LEFT JOIN public.org_grants_saved ogs ON gc.grant_id = ogs.id
WHERE gc.is_deleted = FALSE

UNION ALL

-- Task comments
SELECT
  'task_comment' AS activity_type,
  tc.id AS activity_id,
  tc.org_id,
  tc.user_id,
  gt.grant_id AS related_grant_id,
  tc.task_id AS related_task_id,
  tc.content,
  tc.parent_comment_id,
  tc.mentioned_user_ids,
  tc.created_at,
  u.email AS user_email,
  om.full_name AS user_name,
  ogs.title AS grant_title,
  gt.title AS task_title
FROM public.task_comments tc
JOIN auth.users u ON tc.user_id = u.id
LEFT JOIN public.org_members om ON tc.user_id = om.user_id AND tc.org_id = om.org_id
LEFT JOIN public.grant_tasks gt ON tc.task_id = gt.id
LEFT JOIN public.org_grants_saved ogs ON gt.grant_id = ogs.id
WHERE tc.is_deleted = FALSE

UNION ALL

-- Mention notifications
SELECT
  'mention' AS activity_type,
  mn.id AS activity_id,
  mn.org_id,
  mn.mentioned_by_user_id AS user_id,
  CASE
    WHEN mn.grant_comment_id IS NOT NULL THEN gc.grant_id
    WHEN mn.task_comment_id IS NOT NULL THEN gt.grant_id
  END AS related_grant_id,
  CASE
    WHEN mn.task_comment_id IS NOT NULL THEN tc.task_id
  END AS related_task_id,
  CONCAT('@', target_om.full_name) AS content,
  NULL::UUID AS parent_comment_id,
  ARRAY[mn.user_id]::UUID[] AS mentioned_user_ids,
  mn.created_at,
  u.email AS user_email,
  om.full_name AS user_name,
  mn.context_title AS grant_title,
  NULL AS task_title
FROM public.mention_notifications mn
JOIN auth.users u ON mn.mentioned_by_user_id = u.id
LEFT JOIN public.org_members om ON mn.mentioned_by_user_id = om.user_id AND mn.org_id = om.org_id
LEFT JOIN public.org_members target_om ON mn.user_id = target_om.user_id AND mn.org_id = target_om.org_id
LEFT JOIN public.grant_comments gc ON mn.grant_comment_id = gc.id
LEFT JOIN public.task_comments tc ON mn.task_comment_id = tc.id
LEFT JOIN public.grant_tasks gt ON tc.task_id = gt.id
WHERE mn.dismissed = FALSE;

-- Comment
COMMENT ON VIEW public.activity_stream IS 'Unified activity stream of comments and mentions across grants and tasks';

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE public.grant_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mention_notifications ENABLE ROW LEVEL SECURITY;

-- Grant Comments: Org members can view and manage
DROP POLICY IF EXISTS "Org members can view grant comments" ON public.grant_comments;
CREATE POLICY "Org members can view grant comments"
  ON public.grant_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = grant_comments.org_id
        AND org_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can create grant comments" ON public.grant_comments;
CREATE POLICY "Org members can create grant comments"
  ON public.grant_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = grant_comments.org_id
        AND org_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update own grant comments" ON public.grant_comments;
CREATE POLICY "Users can update own grant comments"
  ON public.grant_comments FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own grant comments" ON public.grant_comments;
CREATE POLICY "Users can delete own grant comments"
  ON public.grant_comments FOR DELETE
  USING (user_id = auth.uid());

-- Task Comments: Similar policies
DROP POLICY IF EXISTS "Org members can view task comments" ON public.task_comments;
CREATE POLICY "Org members can view task comments"
  ON public.task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = task_comments.org_id
        AND org_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can create task comments" ON public.task_comments;
CREATE POLICY "Org members can create task comments"
  ON public.task_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = task_comments.org_id
        AND org_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update own task comments" ON public.task_comments;
CREATE POLICY "Users can update own task comments"
  ON public.task_comments FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own task comments" ON public.task_comments;
CREATE POLICY "Users can delete own task comments"
  ON public.task_comments FOR DELETE
  USING (user_id = auth.uid());

-- Comment Reactions: Users can manage their own reactions
DROP POLICY IF EXISTS "Users can view all reactions" ON public.comment_reactions;
CREATE POLICY "Users can view all reactions"
  ON public.comment_reactions FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Users can create reactions" ON public.comment_reactions;
CREATE POLICY "Users can create reactions"
  ON public.comment_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own reactions" ON public.comment_reactions;
CREATE POLICY "Users can delete own reactions"
  ON public.comment_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Mention Notifications: Users can view their own notifications
DROP POLICY IF EXISTS "Users can view their mention notifications" ON public.mention_notifications;
CREATE POLICY "Users can view their mention notifications"
  ON public.mention_notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their mention notifications" ON public.mention_notifications;
CREATE POLICY "Users can update their mention notifications"
  ON public.mention_notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage mention notifications" ON public.mention_notifications;
CREATE POLICY "Service role can manage mention notifications"
  ON public.mention_notifications FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 7. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to set thread_id on comment creation
CREATE OR REPLACE FUNCTION set_comment_thread_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If no parent, this is root of thread
  IF NEW.parent_comment_id IS NULL THEN
    NEW.thread_id := NEW.id;
  ELSE
    -- Inherit thread_id from parent
    IF TG_TABLE_NAME = 'grant_comments' THEN
      SELECT thread_id INTO NEW.thread_id
      FROM public.grant_comments
      WHERE id = NEW.parent_comment_id;
    ELSIF TG_TABLE_NAME = 'task_comments' THEN
      SELECT thread_id INTO NEW.thread_id
      FROM public.task_comments
      WHERE id = NEW.parent_comment_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for thread_id
DROP TRIGGER IF EXISTS set_grant_comment_thread_id ON public.grant_comments;
CREATE TRIGGER set_grant_comment_thread_id
  BEFORE INSERT ON public.grant_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_comment_thread_id();

DROP TRIGGER IF EXISTS set_task_comment_thread_id ON public.task_comments;
CREATE TRIGGER set_task_comment_thread_id
  BEFORE INSERT ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_comment_thread_id();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.is_edited := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_grant_comment_timestamp ON public.grant_comments;
CREATE TRIGGER update_grant_comment_timestamp
  BEFORE UPDATE ON public.grant_comments
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION update_comment_timestamp();

DROP TRIGGER IF EXISTS update_task_comment_timestamp ON public.task_comments;
CREATE TRIGGER update_task_comment_timestamp
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION update_comment_timestamp();

-- Function to create mention notifications
CREATE OR REPLACE FUNCTION create_mention_notifications()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user UUID;
  context_title_val TEXT;
BEGIN
  -- Only process if there are mentions
  IF NEW.mentioned_user_ids IS NOT NULL AND array_length(NEW.mentioned_user_ids, 1) > 0 THEN

    -- Get context title
    IF TG_TABLE_NAME = 'grant_comments' THEN
      SELECT title INTO context_title_val
      FROM public.org_grants_saved
      WHERE id = NEW.grant_id;
    ELSIF TG_TABLE_NAME = 'task_comments' THEN
      SELECT title INTO context_title_val
      FROM public.grant_tasks
      WHERE id = NEW.task_id;
    END IF;

    -- Create notification for each mentioned user
    FOREACH mentioned_user IN ARRAY NEW.mentioned_user_ids
    LOOP
      -- Don't notify if user mentions themselves
      IF mentioned_user != NEW.user_id THEN
        IF TG_TABLE_NAME = 'grant_comments' THEN
          INSERT INTO public.mention_notifications (
            user_id,
            org_id,
            mentioned_by_user_id,
            grant_comment_id,
            context_type,
            context_title
          ) VALUES (
            mentioned_user,
            NEW.org_id,
            NEW.user_id,
            NEW.id,
            'grant_comment',
            context_title_val
          );
        ELSIF TG_TABLE_NAME = 'task_comments' THEN
          INSERT INTO public.mention_notifications (
            user_id,
            org_id,
            mentioned_by_user_id,
            task_comment_id,
            context_type,
            context_title
          ) VALUES (
            mentioned_user,
            NEW.org_id,
            NEW.user_id,
            NEW.id,
            'task_comment',
            context_title_val
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for mention notifications
DROP TRIGGER IF EXISTS create_grant_comment_mentions ON public.grant_comments;
CREATE TRIGGER create_grant_comment_mentions
  AFTER INSERT ON public.grant_comments
  FOR EACH ROW
  EXECUTE FUNCTION create_mention_notifications();

DROP TRIGGER IF EXISTS create_task_comment_mentions ON public.task_comments;
CREATE TRIGGER create_task_comment_mentions
  AFTER INSERT ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION create_mention_notifications();

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to get comment thread
CREATE OR REPLACE FUNCTION get_comment_thread(
  p_thread_id UUID,
  p_table_name TEXT DEFAULT 'grant_comments'
)
RETURNS TABLE (
  id UUID,
  parent_comment_id UUID,
  user_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_edited BOOLEAN,
  user_name TEXT,
  user_email TEXT,
  level INTEGER
) AS $$
BEGIN
  IF p_table_name = 'grant_comments' THEN
    RETURN QUERY
    WITH RECURSIVE thread AS (
      -- Root comment
      SELECT
        gc.id,
        gc.parent_comment_id,
        gc.user_id,
        gc.content,
        gc.created_at,
        gc.updated_at,
        gc.is_edited,
        om.full_name AS user_name,
        u.email AS user_email,
        0 AS level
      FROM public.grant_comments gc
      JOIN auth.users u ON gc.user_id = u.id
      LEFT JOIN public.org_members om ON gc.user_id = om.user_id
      WHERE gc.thread_id = p_thread_id
        AND gc.parent_comment_id IS NULL
        AND gc.is_deleted = FALSE

      UNION ALL

      -- Replies
      SELECT
        gc.id,
        gc.parent_comment_id,
        gc.user_id,
        gc.content,
        gc.created_at,
        gc.updated_at,
        gc.is_edited,
        om.full_name AS user_name,
        u.email AS user_email,
        t.level + 1
      FROM public.grant_comments gc
      JOIN thread t ON gc.parent_comment_id = t.id
      JOIN auth.users u ON gc.user_id = u.id
      LEFT JOIN public.org_members om ON gc.user_id = om.user_id
      WHERE gc.is_deleted = FALSE
    )
    SELECT * FROM thread ORDER BY created_at ASC;

  ELSIF p_table_name = 'task_comments' THEN
    RETURN QUERY
    WITH RECURSIVE thread AS (
      SELECT
        tc.id,
        tc.parent_comment_id,
        tc.user_id,
        tc.content,
        tc.created_at,
        tc.updated_at,
        tc.is_edited,
        om.full_name AS user_name,
        u.email AS user_email,
        0 AS level
      FROM public.task_comments tc
      JOIN auth.users u ON tc.user_id = u.id
      LEFT JOIN public.org_members om ON tc.user_id = om.user_id
      WHERE tc.thread_id = p_thread_id
        AND tc.parent_comment_id IS NULL
        AND tc.is_deleted = FALSE

      UNION ALL

      SELECT
        tc.id,
        tc.parent_comment_id,
        tc.user_id,
        tc.content,
        tc.created_at,
        tc.updated_at,
        tc.is_edited,
        om.full_name AS user_name,
        u.email AS user_email,
        t.level + 1
      FROM public.task_comments tc
      JOIN thread t ON tc.parent_comment_id = t.id
      JOIN auth.users u ON tc.user_id = u.id
      LEFT JOIN public.org_members om ON tc.user_id = om.user_id
      WHERE tc.is_deleted = FALSE
    )
    SELECT * FROM thread ORDER BY created_at ASC;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get unread mention count
CREATE OR REPLACE FUNCTION get_unread_mention_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.mention_notifications
  WHERE user_id = p_user_id
    AND read = FALSE
    AND dismissed = FALSE;
$$ LANGUAGE sql SECURITY DEFINER;

-- =====================================================
-- 9. INDEXES FOR PERFORMANCE
-- =====================================================

-- Additional composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_grant_comments_grant_thread
  ON public.grant_comments(grant_id, thread_id, created_at ASC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_task_comments_task_thread
  ON public.task_comments(task_id, thread_id, created_at ASC)
  WHERE is_deleted = FALSE;

-- =====================================================
-- 10. SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Uncomment to insert sample comments for testing
-- INSERT INTO public.grant_comments (grant_id, org_id, user_id, content)
-- SELECT
--   ogs.id,
--   ogs.org_id,
--   om.user_id,
--   'This is a sample comment on the grant'
-- FROM public.org_grants_saved ogs
-- JOIN public.org_members om ON ogs.org_id = om.org_id
-- LIMIT 1;
