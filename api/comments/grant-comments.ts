/**
 * Grant Comments API
 *
 * GET /api/comments/grant-comments?grant_id=xxx
 *   - Get all comments for a grant (threaded)
 *
 * POST /api/comments/grant-comments
 *   - Create a new comment or reply
 *   - Body: { grant_id, content, parent_comment_id?, mentioned_user_ids? }
 *
 * PUT /api/comments/grant-comments/:id
 *   - Update a comment
 *   - Body: { content }
 *
 * DELETE /api/comments/grant-comments/:id
 *   - Soft delete a comment
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { validateQuery, validateBody, validateId, commentQuerySchema, commentCreateSchema, commentUpdateSchema } from '../utils/validation';

interface CreateCommentRequest {
  grant_id: string;
  content: string;
  parent_comment_id?: string;
  mentioned_user_ids?: string[];
}

interface UpdateCommentRequest {
  content: string;
}

/**
 * Parse @mentions from comment text
 * Format: @[User Name](user-id)
 */
function parseMentions(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[2]); // Extract user ID
  }

  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Render HTML with highlighted mentions
 */
function renderMentionsHtml(content: string): string {
  return content.replace(
    /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g,
    '<span class="mention" data-user-id="$2">@$1</span>'
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get authenticated user
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }

  // =====================================================
  // GET: Retrieve comments for a grant
  // =====================================================
  if (req.method === 'GET') {
    try {
      const validationResult = validateQuery(req, res, commentQuerySchema);
      if (!validationResult.success) return;

      const { grant_id } = validationResult.data;

      // Get grant to verify access and get org_id
      const { data: grant, error: grantError } = await supabase
        .from('org_grants_saved')
        .select('org_id')
        .eq('id', grant_id)
        .single();

      if (grantError || !grant) {
        return res.status(404).json({ error: 'Grant not found' });
      }

      // Verify user is org member
      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', grant.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get all comments for this grant
      const { data: comments, error: commentsError } = await supabase
        .from('grant_comments')
        .select('*')
        .eq('grant_id', grant_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Get user IDs for enrichment
      const userIds = [...new Set(comments?.map(c => c.user_id) || [])];

      // Get user profiles for full_name and avatar
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      // Get emails from auth.users
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const emailMap = new Map(
        authUsers.users?.map(u => [u.id, u.email]) || []
      );

      const profileMap = new Map(
        profiles?.map(p => [p.id, p]) || []
      );

      // Enrich comments with user info
      const enrichedComments = comments?.map(comment => {
        const profile = profileMap.get(comment.user_id);
        const email = emailMap.get(comment.user_id);

        return {
          ...comment,
          user_name: profile?.full_name || email || 'Unknown User',
          user_avatar: profile?.avatar_url,
        };
      }) || [];

      // Build threaded structure
      const commentMap = new Map(enrichedComments.map(c => [c.id, { ...c, replies: [] }]));
      const threads: any[] = [];

      enrichedComments.forEach(comment => {
        const enrichedComment = commentMap.get(comment.id)!;

        if (comment.parent_comment_id) {
          const parent = commentMap.get(comment.parent_comment_id);
          if (parent) {
            parent.replies.push(enrichedComment);
          }
        } else {
          threads.push(enrichedComment);
        }
      });

      return res.status(200).json({
        comments: threads,
        total_count: enrichedComments.length,
      });
    } catch (error) {
      console.error('[Grant Comments GET] Error:', error);
      return res.status(500).json({
        error: 'Failed to fetch comments',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // =====================================================
  // POST: Create a new comment
  // =====================================================
  if (req.method === 'POST') {
    try {
      const validationResult = validateBody(req, res, commentCreateSchema);
      if (!validationResult.success) return;

      const {
        grant_id,
        content,
        parent_comment_id,
        mentioned_user_ids,
      } = validationResult.data;

      // Get grant to verify access and get org_id
      const { data: grant, error: grantError } = await supabase
        .from('org_grants_saved')
        .select('org_id')
        .eq('id', grant_id)
        .single();

      if (grantError || !grant) {
        return res.status(404).json({ error: 'Grant not found' });
      }

      // Verify user is org member
      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', grant.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Parse mentions from content
      const parsedMentions = parseMentions(content);
      const finalMentions = mentioned_user_ids || parsedMentions;

      // Render HTML with highlighted mentions
      const contentHtml = renderMentionsHtml(content);

      // Create comment
      const { data: newComment, error: createError } = await supabase
        .from('grant_comments')
        .insert({
          grant_id,
          org_id: grant.org_id,
          user_id: user.id,
          content: content.trim(),
          content_html: contentHtml,
          parent_comment_id: parent_comment_id || null,
          mentioned_user_ids: finalMentions.length > 0 ? finalMentions : null,
        })
        .select()
        .single();

      if (createError) throw createError;

      console.log(`[Grant Comments] Created comment ${newComment.id} by ${user.email}`);

      return res.status(201).json({
        comment: newComment,
        message: 'Comment created successfully',
      });
    } catch (error) {
      console.error('[Grant Comments POST] Error:', error);
      return res.status(500).json({
        error: 'Failed to create comment',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // =====================================================
  // PUT: Update a comment
  // =====================================================
  if (req.method === 'PUT') {
    try {
      const idValidation = validateId(req, res);
      if (!idValidation.success) return;
      const id = idValidation.data;

      const validationResult = validateBody(req, res, commentUpdateSchema);
      if (!validationResult.success) return;

      const { content } = validationResult.data;

      // Get comment to verify ownership
      const { data: comment, error: commentError } = await supabase
        .from('grant_comments')
        .select('user_id, org_id')
        .eq('id', id)
        .single();

      if (commentError || !comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.user_id !== user.id) {
        return res.status(403).json({ error: 'You can only edit your own comments' });
      }

      // Parse mentions and render HTML
      const mentions = parseMentions(content);
      const contentHtml = renderMentionsHtml(content);

      // Update comment
      const { data: updated, error: updateError } = await supabase
        .from('grant_comments')
        .update({
          content: content.trim(),
          content_html: contentHtml,
          mentioned_user_ids: mentions.length > 0 ? mentions : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log(`[Grant Comments] Updated comment ${id}`);

      return res.status(200).json({
        comment: updated,
        message: 'Comment updated successfully',
      });
    } catch (error) {
      console.error('[Grant Comments PUT] Error:', error);
      return res.status(500).json({
        error: 'Failed to update comment',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // =====================================================
  // DELETE: Soft delete a comment
  // =====================================================
  if (req.method === 'DELETE') {
    try {
      const idValidation = validateId(req, res);
      if (!idValidation.success) return;
      const id = idValidation.data;

      // Get comment to verify ownership
      const { data: comment, error: commentError } = await supabase
        .from('grant_comments')
        .select('user_id')
        .eq('id', id)
        .single();

      if (commentError || !comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.user_id !== user.id) {
        return res.status(403).json({ error: 'You can only delete your own comments' });
      }

      // Soft delete
      const { error: deleteError } = await supabase
        .from('grant_comments')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (deleteError) throw deleteError;

      console.log(`[Grant Comments] Deleted comment ${id}`);

      return res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('[Grant Comments DELETE] Error:', error);
      return res.status(500).json({
        error: 'Failed to delete comment',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET, POST, PUT, or DELETE.' });
}
