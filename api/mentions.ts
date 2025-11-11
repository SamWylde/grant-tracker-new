/**
 * Mention Notifications API
 *
 * GET /api/mentions?user_id=xxx&unread_only=true
 *   - Get mention notifications for a user
 *
 * PUT /api/mentions/:id
 *   - Mark as read or dismissed
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

  // =====================================================
  // GET: Retrieve mention notifications
  // =====================================================
  if (req.method === 'GET') {
    try {
      const { user_id, org_id, unread_only = 'false', limit = '50' } = req.query;

      // Users can only get their own notifications
      const targetUserId = user_id || user.id;
      if (targetUserId !== user.id) {
        return res.status(403).json({ error: 'You can only view your own notifications' });
      }

      let query = supabase
        .from('mention_notifications')
        .select(`
          *,
          grant_comment:grant_comment_id (
            id,
            content
          ),
          task_comment:task_comment_id (
            id,
            content
          )
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit as string, 10));

      if (org_id) {
        query = query.eq('org_id', org_id);
      }

      if (unread_only === 'true') {
        query = query.eq('read', false).eq('dismissed', false);
      }

      const { data: notifications, error: notificationsError } = await query;

      if (notificationsError) throw notificationsError;

      // Get user IDs for enrichment
      const userIds = [
        ...new Set(notifications?.map(n => n.mentioned_by_user_id) || [])
      ];

      // Get user profiles for mentioned_by users
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

      // Enrich notifications
      const enrichedNotifications = notifications?.map(notification => {
        const profile = profileMap.get(notification.mentioned_by_user_id);
        const email = emailMap.get(notification.mentioned_by_user_id);

        return {
          ...notification,
          mentioned_by_name: profile?.full_name || email || 'Unknown User',
          mentioned_by_avatar: profile?.avatar_url,
        };
      }) || [];

      // Get unread count
      const unreadCount = enrichedNotifications.filter(
        n => !n.read && !n.dismissed
      ).length;

      return res.status(200).json({
        notifications: enrichedNotifications,
        unread_count: unreadCount,
        total_count: enrichedNotifications.length,
      });
    } catch (error) {
      console.error('[Mentions GET] Error:', error);
      return res.status(500).json({
        error: 'Failed to fetch notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // =====================================================
  // PUT: Update notification status
  // =====================================================
  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const { read, dismissed } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'notification id is required' });
      }

      // Verify ownership
      const { data: notification, error: notificationError } = await supabase
        .from('mention_notifications')
        .select('user_id')
        .eq('id', id)
        .single();

      if (notificationError || !notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      if (notification.user_id !== user.id) {
        return res.status(403).json({ error: 'You can only update your own notifications' });
      }

      const updateData: any = {};

      if (typeof read === 'boolean') {
        updateData.read = read;
        updateData.read_at = read ? new Date().toISOString() : null;
      }

      if (typeof dismissed === 'boolean') {
        updateData.dismissed = dismissed;
        updateData.dismissed_at = dismissed ? new Date().toISOString() : null;
      }

      const { data: updated, error: updateError } = await supabase
        .from('mention_notifications')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.status(200).json({
        notification: updated,
        message: 'Notification updated successfully',
      });
    } catch (error) {
      console.error('[Mentions PUT] Error:', error);
      return res.status(500).json({
        error: 'Failed to update notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // =====================================================
  // POST: Mark all as read
  // =====================================================
  if (req.method === 'POST') {
    try {
      const { action } = req.body;

      if (action !== 'mark_all_read') {
        return res.status(400).json({ error: 'Invalid action' });
      }

      const { error: updateError } = await supabase
        .from('mention_notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('read', false);

      if (updateError) throw updateError;

      return res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error) {
      console.error('[Mentions POST] Error:', error);
      return res.status(500).json({
        error: 'Failed to mark all as read',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET, PUT, or POST.' });
}
