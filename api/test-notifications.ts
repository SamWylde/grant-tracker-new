/**
 * Test Notifications Endpoint
 *
 * Simple test endpoint to verify webhook notifications are working
 * Access via: GET /api/test-notifications?org_id=xxx&event=grant.saved
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendNotifications } from './utils/notifications';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { org_id, event } = req.query;

  if (!org_id || typeof org_id !== 'string') {
    return res.status(400).json({ error: 'org_id query parameter is required' });
  }

  const eventType = (event as string) || 'grant.saved';

  // Validate event type
  const validEvents = ['grant.saved', 'grant.updated', 'grant.task_assigned', 'grant.deadline_approaching', 'grant.deadline_passed'];
  if (!validEvents.includes(eventType)) {
    return res.status(400).json({ error: `Invalid event type. Must be one of: ${validEvents.join(', ')}` });
  }

  try {
    const origin = req.headers.origin || 'https://grantcue.com';

    // Send test notification
    await sendNotifications({
      event: eventType,
      org_id: org_id,
      grant_id: 'test-grant-id',
      grant_title: 'Test Grant: National Science Foundation Research Award',
      grant_agency: 'National Science Foundation',
      grant_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      task_id: eventType === 'grant.task_assigned' ? 'test-task-id' : undefined,
      task_title: eventType === 'grant.task_assigned' ? 'Review grant requirements' : undefined,
      assigned_to_id: eventType === 'grant.task_assigned' ? 'test-user-id' : undefined,
      assigned_to_name: eventType === 'grant.task_assigned' ? 'John Doe' : undefined,
      action_url: `${origin}/grants/test-grant-id`,
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Test notification sent for event: ${eventType}`,
      org_id: org_id,
      event: eventType,
      note: 'Check your configured webhooks, Slack channels, and Teams channels for the test notification',
    });
  } catch (error) {
    console.error('[Test Notifications] Error:', error);
    return res.status(500).json({
      error: 'Failed to send test notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
