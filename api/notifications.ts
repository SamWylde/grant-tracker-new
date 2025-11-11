import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Create Supabase client with user's token
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GET - List notifications for user
    if (req.method === 'GET') {
      const { limit = '50', unread_only = 'false' } = req.query;

      let query = supabase
        .from('in_app_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit as string));

      if (unread_only === 'true') {
        query = query.is('read_at', null);
      }

      const { data: notifications, error } = await query;

      if (error) throw error;

      // Also get unread count
      const { count: unreadCount, error: countError } = await supabase
        .from('in_app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (countError) throw countError;

      return res.status(200).json({
        notifications,
        unreadCount: unreadCount || 0,
      });
    }

    // POST - Mark notification(s) as read
    if (req.method === 'POST') {
      const { notification_ids, mark_all_read } = req.body;

      if (mark_all_read) {
        // Mark all notifications as read
        const { error } = await supabase
          .from('in_app_notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .is('read_at', null);

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'All notifications marked as read' });
      }

      if (!notification_ids || !Array.isArray(notification_ids)) {
        return res.status(400).json({ error: 'notification_ids array is required' });
      }

      // Mark specific notifications as read
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', notification_ids)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    // DELETE - Delete notification(s)
    if (req.method === 'DELETE') {
      const { notification_id, notification_ids } = req.query;

      if (notification_id && typeof notification_id === 'string') {
        // Delete single notification
        const { error } = await supabase
          .from('in_app_notifications')
          .delete()
          .eq('id', notification_id)
          .eq('user_id', user.id);

        if (error) throw error;

        return res.status(200).json({ success: true });
      }

      if (notification_ids && typeof notification_ids === 'string') {
        // Delete multiple notifications
        const ids = notification_ids.split(',');
        const { error } = await supabase
          .from('in_app_notifications')
          .delete()
          .in('id', ids)
          .eq('user_id', user.id);

        if (error) throw error;

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'notification_id or notification_ids required' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in notifications API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
