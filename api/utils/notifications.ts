/**
 * Notification Utility
 *
 * Handles sending notifications to Slack, Teams, and custom webhooks
 * for grant-related events
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface NotificationPayload {
  event: string;
  org_id: string;
  grant_id: string;
  grant_title: string;
  grant_agency?: string;
  grant_deadline?: string;
  task_id?: string;
  task_title?: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  action_url: string;
  metadata?: Record<string, any>;
}

interface SlackMessage {
  text: string;
  blocks: any[];
}

interface TeamsMessage {
  type: string;
  attachments: any[];
}

/**
 * Format notification message for Slack
 */
function formatSlackMessage(payload: NotificationPayload): SlackMessage {
  let text = '';
  let emoji = '📋';
  const blocks: any[] = [];

  switch (payload.event) {
    case 'grant.saved':
      emoji = '✅';
      text = `New grant saved: ${payload.grant_title}`;
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *New Grant Saved*\n\n*${payload.grant_title}*${payload.grant_agency ? `\n_${payload.grant_agency}_` : ''}${payload.grant_deadline ? `\n📅 Deadline: ${new Date(payload.grant_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}`,
        },
      });
      break;

    case 'grant.updated':
      emoji = '📝';
      text = `Grant updated: ${payload.grant_title}`;
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Grant Updated*\n\n*${payload.grant_title}*${payload.grant_agency ? `\n_${payload.grant_agency}_` : ''}`,
        },
      });
      break;

    case 'grant.task_assigned':
      emoji = '👤';
      text = `Task assigned: ${payload.task_title || 'New task'}`;
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Task Assigned*\n\n*${payload.task_title || 'New task'}*\nGrant: ${payload.grant_title}${payload.assigned_to_name ? `\nAssigned to: ${payload.assigned_to_name}` : ''}`,
        },
      });
      break;

    case 'grant.deadline_approaching':
      emoji = '⚠️';
      text = `Deadline approaching: ${payload.grant_title}`;
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Deadline Approaching*\n\n*${payload.grant_title}*${payload.grant_agency ? `\n_${payload.grant_agency}_` : ''}${payload.grant_deadline ? `\n📅 Deadline: ${new Date(payload.grant_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}`,
        },
      });
      break;

    case 'grant.deadline_passed':
      emoji = '🚨';
      text = `Deadline passed: ${payload.grant_title}`;
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Deadline Passed*\n\n*${payload.grant_title}*${payload.grant_agency ? `\n_${payload.grant_agency}_` : ''}${payload.grant_deadline ? `\n📅 Deadline was: ${new Date(payload.grant_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}`,
        },
      });
      break;

    default:
      text = `Grant event: ${payload.event}`;
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${payload.event}*\n\n${payload.grant_title}`,
        },
      });
  }

  // Add action button
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Grant',
          emoji: true,
        },
        url: payload.action_url,
        style: 'primary',
      },
    ],
  });

  return { text, blocks };
}

/**
 * Format notification message for Microsoft Teams
 */
function formatTeamsMessage(payload: NotificationPayload): TeamsMessage {
  let title = '';
  let color = '0078D4';
  let text = '';

  switch (payload.event) {
    case 'grant.saved':
      title = '✅ New Grant Saved';
      color = '28A745';
      text = payload.grant_title;
      break;

    case 'grant.updated':
      title = '📝 Grant Updated';
      color = '0078D4';
      text = payload.grant_title;
      break;

    case 'grant.task_assigned':
      title = '👤 Task Assigned';
      color = '7C3AED';
      text = `${payload.task_title || 'New task'} - ${payload.grant_title}`;
      break;

    case 'grant.deadline_approaching':
      title = '⚠️ Deadline Approaching';
      color = 'FFC107';
      text = payload.grant_title;
      break;

    case 'grant.deadline_passed':
      title = '🚨 Deadline Passed';
      color = 'DC3545';
      text = payload.grant_title;
      break;

    default:
      title = payload.event;
      text = payload.grant_title;
  }

  const facts: any[] = [];
  if (payload.grant_agency) {
    facts.push({ name: 'Agency', value: payload.grant_agency });
  }
  if (payload.grant_deadline) {
    facts.push({
      name: 'Deadline',
      value: new Date(payload.grant_deadline).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    });
  }
  if (payload.assigned_to_name) {
    facts.push({ name: 'Assigned To', value: payload.assigned_to_name });
  }

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          body: [
            {
              type: 'TextBlock',
              size: 'Large',
              weight: 'Bolder',
              text: title,
              wrap: true,
            },
            {
              type: 'TextBlock',
              text: text,
              wrap: true,
              size: 'Medium',
            },
            ...(facts.length > 0
              ? [
                  {
                    type: 'FactSet',
                    facts: facts,
                  },
                ]
              : []),
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'View Grant',
              url: payload.action_url,
            },
          ],
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4',
        },
      },
    ],
  };
}

/**
 * Sign webhook payload with secret
 */
function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Send notification to a webhook endpoint
 */
async function sendWebhook(
  webhook: any,
  payload: NotificationPayload,
  supabase: SupabaseClient
): Promise<void> {
  const webhookPayload = {
    event: payload.event,
    timestamp: new Date().toISOString(),
    data: {
      grant_id: payload.grant_id,
      grant_title: payload.grant_title,
      grant_agency: payload.grant_agency,
      grant_deadline: payload.grant_deadline,
      task_id: payload.task_id,
      task_title: payload.task_title,
      assigned_to_id: payload.assigned_to_id,
      assigned_to_name: payload.assigned_to_name,
      action_url: payload.action_url,
      ...payload.metadata,
    },
  };

  const payloadString = JSON.stringify(webhookPayload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'GrantCue-Webhook/1.0',
  };

  // Add signature if secret is provided
  if (webhook.secret) {
    headers['X-Webhook-Signature'] = signPayload(payloadString, webhook.secret);
  }

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
    });

    const responseBody = await response.text();

    // Log delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhook.id,
      event_type: payload.event,
      payload: webhookPayload,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000), // Limit to 1000 chars
      delivered_at: new Date().toISOString(),
      error_message: response.ok ? null : `HTTP ${response.status}: ${responseBody.substring(0, 200)}`,
    });

    // Update webhook stats
    if (response.ok) {
      await supabase
        .from('webhooks')
        .update({
          last_triggered_at: new Date().toISOString(),
          total_deliveries: webhook.total_deliveries + 1,
        })
        .eq('id', webhook.id);
    } else {
      await supabase
        .from('webhooks')
        .update({
          last_triggered_at: new Date().toISOString(),
          total_deliveries: webhook.total_deliveries + 1,
          failed_deliveries: webhook.failed_deliveries + 1,
        })
        .eq('id', webhook.id);
    }

    console.log(
      `[Notifications] Webhook ${webhook.name} delivered with status ${response.status}`
    );
  } catch (error) {
    console.error(`[Notifications] Failed to send webhook ${webhook.name}:`, error);

    // Log failed delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhook.id,
      event_type: payload.event,
      payload: webhookPayload,
      response_status: null,
      response_body: null,
      delivered_at: new Date().toISOString(),
      error_message: sanitizeError(error),
    });

    // Update webhook stats
    await supabase
      .from('webhooks')
      .update({
        last_triggered_at: new Date().toISOString(),
        total_deliveries: webhook.total_deliveries + 1,
        failed_deliveries: webhook.failed_deliveries + 1,
      })
      .eq('id', webhook.id);
  }
}

/**
 * Send notification to Slack integration
 */
async function sendSlackNotification(
  integration: any,
  payload: NotificationPayload,
  supabase: SupabaseClient
): Promise<void> {
  if (!integration.webhook_url && !integration.channel_id) {
    console.warn('[Notifications] Slack integration missing webhook URL or channel ID');
    return;
  }

  const slackMessage = formatSlackMessage(payload);

  try {
    const response = await fetch(integration.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Notifications] Slack notification failed: ${response.status} - ${errorText}`
      );
    } else {
      console.log('[Notifications] Slack notification sent successfully');
    }
  } catch (error) {
    console.error('[Notifications] Failed to send Slack notification:', error);
  }
}

/**
 * Send notification to Microsoft Teams integration
 */
async function sendTeamsNotification(
  integration: any,
  payload: NotificationPayload,
  supabase: SupabaseClient
): Promise<void> {
  if (!integration.webhook_url) {
    console.warn('[Notifications] Teams integration missing webhook URL');
    return;
  }

  const teamsMessage = formatTeamsMessage(payload);

  try {
    const response = await fetch(integration.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teamsMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Notifications] Teams notification failed: ${response.status} - ${errorText}`
      );
    } else {
      console.log('[Notifications] Teams notification sent successfully');
    }
  } catch (error) {
    console.error('[Notifications] Failed to send Teams notification:', error);
  }
}

/**
 * Main function to send notifications for a grant event
 */
export async function sendNotifications(payload: NotificationPayload): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Notifications] Missing Supabase configuration');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch active webhooks for this org that subscribe to this event
    const { data: webhooks, error: webhooksError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('org_id', payload.org_id)
      .eq('is_active', true)
      .contains('events', [payload.event]);

    if (webhooksError) {
      console.error('[Notifications] Error fetching webhooks:', webhooksError);
    } else if (webhooks && webhooks.length > 0) {
      console.log(`[Notifications] Sending to ${webhooks.length} webhooks for event ${payload.event}`);
      await Promise.all(webhooks.map((webhook) => sendWebhook(webhook, payload, supabase)));
    }

    // Fetch active integrations for this org
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('*')
      .eq('org_id', payload.org_id)
      .eq('is_active', true);

    if (integrationsError) {
      console.error('[Notifications] Error fetching integrations:', integrationsError);
    } else if (integrations && integrations.length > 0) {
      for (const integration of integrations) {
        if (integration.integration_type === 'slack' && integration.webhook_url) {
          await sendSlackNotification(integration, payload, supabase);
        } else if (integration.integration_type === 'microsoft_teams' && integration.webhook_url) {
          await sendTeamsNotification(integration, payload, supabase);
        }
      }
    }
  } catch (error) {
    console.error('[Notifications] Error sending notifications:', error);
  }
}

/**
 * Helper to get assigned user's name
 */
export async function getAssignedUserName(userId: string): Promise<string | null> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.full_name;
  } catch {
    return null;
  }
}
