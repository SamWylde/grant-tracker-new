/**
 * Task Comments API
 *
 * GET /api/comments/task-comments?task_id=xxx
 *   - Get all comments for a task (threaded)
 *
 * POST /api/comments/task-comments
 *   - Create a new comment or reply
 *
 * PUT /api/comments/task-comments/:id
 *   - Update a comment
 *
 * DELETE /api/comments/task-comments/:id
 *   - Soft delete a comment
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface CreateCommentRequest {
  task_id: string;
  content: string;
  parent_comment_id?: string;
  mentioned_user_ids?: string[];
}

interface UpdateCommentRequest {
  content: string;
}

function parseMentions(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[2]);
  }

  return [...new Set(mentions)];
}

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

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }

  if (req.method === 'GET') {
    try {
      const { task_id } = req.query;

      if (!task_id) {
        return res.status(400).json({ error: 'task_id is required' });
      }

      // Get task to verify access
      const { data: task, error: taskError } = await supabase
        .from('grant_tasks')
        .select('org_id, grant_id')
        .eq('id', task_id)
        .single();

      if (taskError || !task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Verify user is org member
      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', task.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get comments
      const { data: comments, error: commentsError } = await supabase
        .from('task_comments')
        .select(`
          *,
          user:user_id (
            id,
            email
          )
        `)
        .eq('task_id', task_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Get org member info
      const userIds = [...new Set(comments?.map(c => c.user_id) || [])];
      const { data: members } = await supabase
        .from('org_members')
        .select('user_id, full_name, avatar_url')
        .eq('org_id', task.org_id)
        .in('user_id', userIds);

      const memberMap = new Map(
        members?.map(m => [m.user_id, m]) || []
      );

      const enrichedComments = comments?.map(comment => ({
        ...comment,
        user_name: memberMap.get(comment.user_id)?.full_name || comment.user.email,
        user_avatar: memberMap.get(comment.user_id)?.avatar_url,
      })) || [];

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
      console.error('[Task Comments GET] Error:', error);
      return res.status(500).json({
        error: 'Failed to fetch comments',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        task_id,
        content,
        parent_comment_id,
        mentioned_user_ids,
      }: CreateCommentRequest = req.body;

      if (!task_id) {
        return res.status(400).json({ error: 'task_id is required' });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'content is required' });
      }

      if (content.length > 10000) {
        return res.status(400).json({ error: 'content must be 10000 characters or less' });
      }

      // Get task to verify access
      const { data: task, error: taskError } = await supabase
        .from('grant_tasks')
        .select('org_id')
        .eq('id', task_id)
        .single();

      if (taskError || !task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Verify user is org member
      const { data: membership } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', task.org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const parsedMentions = parseMentions(content);
      const finalMentions = mentioned_user_ids || parsedMentions;
      const contentHtml = renderMentionsHtml(content);

      const { data: newComment, error: createError } = await supabase
        .from('task_comments')
        .insert({
          task_id,
          org_id: task.org_id,
          user_id: user.id,
          content: content.trim(),
          content_html: contentHtml,
          parent_comment_id: parent_comment_id || null,
          mentioned_user_ids: finalMentions.length > 0 ? finalMentions : null,
        })
        .select()
        .single();

      if (createError) throw createError;

      console.log(`[Task Comments] Created comment ${newComment.id}`);

      return res.status(201).json({
        comment: newComment,
        message: 'Comment created successfully',
      });
    } catch (error) {
      console.error('[Task Comments POST] Error:', error);
      return res.status(500).json({
        error: 'Failed to create comment',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const { content }: UpdateCommentRequest = req.body;

      if (!id) {
        return res.status(400).json({ error: 'comment id is required' });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'content is required' });
      }

      if (content.length > 10000) {
        return res.status(400).json({ error: 'content must be 10000 characters or less' });
      }

      const { data: comment, error: commentError } = await supabase
        .from('task_comments')
        .select('user_id')
        .eq('id', id)
        .single();

      if (commentError || !comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.user_id !== user.id) {
        return res.status(403).json({ error: 'You can only edit your own comments' });
      }

      const mentions = parseMentions(content);
      const contentHtml = renderMentionsHtml(content);

      const { data: updated, error: updateError } = await supabase
        .from('task_comments')
        .update({
          content: content.trim(),
          content_html: contentHtml,
          mentioned_user_ids: mentions.length > 0 ? mentions : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.status(200).json({
        comment: updated,
        message: 'Comment updated successfully',
      });
    } catch (error) {
      console.error('[Task Comments PUT] Error:', error);
      return res.status(500).json({
        error: 'Failed to update comment',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'comment id is required' });
      }

      const { data: comment, error: commentError } = await supabase
        .from('task_comments')
        .select('user_id')
        .eq('id', id)
        .single();

      if (commentError || !comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.user_id !== user.id) {
        return res.status(403).json({ error: 'You can only delete your own comments' });
      }

      const { error: deleteError } = await supabase
        .from('task_comments')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (deleteError) throw deleteError;

      return res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('[Task Comments DELETE] Error:', error);
      return res.status(500).json({
        error: 'Failed to delete comment',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET, POST, PUT, or DELETE.' });
}
