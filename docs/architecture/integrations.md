# Third-Party Integrations

## Overview

GrantCue integrates with various third-party services to extend functionality, enable notifications, and synchronize data across platforms. This document describes the architecture, implementation, and usage of these integrations.

## Integration Types

### 1. OAuth Integrations

OAuth-based integrations requiring user authorization.

**Supported Services**:
- Google Calendar
- Slack
- Microsoft Teams

**Common Flow**:
```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User   │───>│GrantCue  │───>│  OAuth   │───>│  User    │
│ Client  │    │   API    │    │ Provider │    │ Approves │
└─────────┘    └──────────┘    └──────────┘    └──────────┘
     │              │                │                │
     │ 1. Initiate  │                │                │
     ├─────────────>│                │                │
     │              │ 2. Redirect    │                │
     │              ├───────────────>│                │
     │              │                │ 3. Auth Screen │
     │              │                ├───────────────>│
     │              │                │<───────────────┤
     │              │ 4. Auth Code   │                │
     │              │<───────────────┤                │
     │              │ 5. Exchange    │                │
     │              ├───────────────>│                │
     │              │ 6. Access Token│                │
     │              │<───────────────┤                │
     │              │ 7. Store Tokens│                │
     │ 8. Success   │                │                │
     │<─────────────┤                │                │
```

### 2. Webhook Integrations

Custom webhooks for event-driven notifications.

**Features**:
- Custom HTTP endpoints
- Event filtering
- Delivery tracking
- Automatic retries

## Google Calendar Integration

### Purpose

Synchronize grant deadlines to Google Calendar for easy tracking and reminders.

### Setup Flow

```
┌─────────┐    ┌──────────────┐    ┌─────────────┐
│  User   │───>│ /api/oauth/  │───>│   Google    │
│         │    │ google/      │    │   OAuth     │
│         │    │ authorize    │    └─────────────┘
└─────────┘    └──────────────┘           │
     │                │                   │
     │ 1. Click "Connect Calendar"       │
     ├───────────────>│                   │
     │                │ 2. Redirect       │
     │                ├──────────────────>│
     │                │                   │
     │ 3. Approve     │                   │
     ├──────────────────────────────────>│
     │                │                   │
     │                │ 4. Callback       │
     │                │<──────────────────┤
     │                │ 5. Store Tokens   │
     │                │                   │
     │ 6. Redirect    │                   │
     │<───────────────┤                   │
```

### Configuration

**Environment Variables**:
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://grantcue.com/api/oauth/google/callback
```

**OAuth Scopes**:
- `https://www.googleapis.com/auth/calendar.events` - Create/edit calendar events

### Implementation

#### Authorization Endpoint

**Location**: `/api/oauth/google/authorize.ts`

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { org_id } = req.query;

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');

  // Store state in database
  await supabase.from('oauth_state_tokens').insert({
    state,
    org_id,
    expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  });

  // Build OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI!);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline'); // Get refresh token
  authUrl.searchParams.set('prompt', 'consent');

  res.redirect(authUrl.toString());
}
```

#### Callback Endpoint

**Location**: `/api/oauth/google/callback.ts`

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query;

  // Verify state token
  const { data: stateToken } = await supabase
    .from('oauth_state_tokens')
    .select('*')
    .eq('state', state)
    .single();

  if (!stateToken) {
    return res.status(400).send('Invalid state token');
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });

  const tokens = await tokenResponse.json();

  // Store tokens (encrypted)
  await supabase.from('integrations').upsert({
    org_id: stateToken.org_id,
    integration_type: 'google_calendar',
    access_token: encrypt(tokens.access_token),
    refresh_token: encrypt(tokens.refresh_token),
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    is_active: true
  });

  // Delete state token
  await supabase.from('oauth_state_tokens').delete().eq('state', state);

  res.redirect('/settings/integrations?success=google');
}
```

### Syncing Deadlines

When a grant deadline is added or updated:

```typescript
async function syncDeadlineToGoogleCalendar(grantId: string, orgId: string) {
  // Get integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('org_id', orgId)
    .eq('integration_type', 'google_calendar')
    .eq('is_active', true)
    .single();

  if (!integration) return;

  // Refresh token if needed
  if (new Date(integration.token_expires_at) < new Date()) {
    await refreshGoogleToken(integration.id);
  }

  // Get grant details
  const { data: grant } = await supabase
    .from('org_grants_saved')
    .select('*')
    .eq('id', grantId)
    .single();

  // Create calendar event
  const event = {
    summary: `Grant Deadline: ${grant.title}`,
    description: `Application deadline for ${grant.title}\nAgency: ${grant.agency}`,
    start: {
      dateTime: grant.close_date
    },
    end: {
      dateTime: grant.close_date
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 30 }
      ]
    }
  };

  await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${decrypt(integration.access_token)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });
}
```

### Token Refresh

```typescript
async function refreshGoogleToken(integrationId: string) {
  const { data: integration } = await supabase
    .from('integrations')
    .select('refresh_token')
    .eq('id', integrationId)
    .single();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: decrypt(integration.refresh_token),
      grant_type: 'refresh_token'
    })
  });

  const tokens = await response.json();

  await supabase
    .from('integrations')
    .update({
      access_token: encrypt(tokens.access_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000)
    })
    .eq('id', integrationId);
}
```

## Slack Integration

### Purpose

Send notifications about grant deadlines, team mentions, and workflow approvals to Slack channels.

### Setup Flow

Similar to Google Calendar with Slack-specific OAuth endpoints.

### Configuration

**Environment Variables**:
```bash
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=https://grantcue.com/api/oauth/slack/callback
```

**OAuth Scopes**:
- `incoming-webhook` - Post messages to channels
- `chat:write` - Send messages as bot

### Sending Notifications

```typescript
async function sendSlackNotification(
  orgId: string,
  message: string,
  blocks?: any[]
) {
  // Get Slack integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('org_id', orgId)
    .eq('integration_type', 'slack')
    .eq('is_active', true)
    .single();

  if (!integration) return;

  // Send message
  await fetch(integration.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: message,
      blocks: blocks || [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message
          }
        }
      ]
    })
  });
}

// Usage example
await sendSlackNotification(
  orgId,
  '*Grant Deadline Reminder*\nThe deadline for *Infrastructure Grant 2024* is in 3 days.',
  [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Grant Deadline Reminder*\nThe deadline for *Infrastructure Grant 2024* is in 3 days.'
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Grant' },
          url: `https://grantcue.com/grants/${grantId}`
        }
      ]
    }
  ]
);
```

### Message Templates

**Deadline Reminder**:
```typescript
const deadlineMessage = {
  text: `Grant deadline approaching: ${grant.title}`,
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '⏰ Grant Deadline Reminder'
      }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Grant:*\n${grant.title}` },
        { type: 'mrkdwn', text: `*Deadline:*\n${formatDate(grant.close_date)}` },
        { type: 'mrkdwn', text: `*Agency:*\n${grant.agency}` },
        { type: 'mrkdwn', text: `*Days Remaining:*\n${daysRemaining}` }
      ]
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Details' },
          url: `https://grantcue.com/grants/${grant.id}`
        }
      ]
    }
  ]
};
```

**Team Mention**:
```typescript
const mentionMessage = {
  text: `${mentioner.name} mentioned you in a comment`,
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${mentioner.name}* mentioned you in a comment on *${grant.title}*`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `> ${comment}`
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Comment' },
          url: `https://grantcue.com/grants/${grant.id}#comment-${commentId}`
        }
      ]
    }
  ]
};
```

## Microsoft Teams Integration

### Purpose

Send notifications to Microsoft Teams channels.

### Configuration

**Environment Variables**:
```bash
MICROSOFT_CLIENT_ID=your-app-id
MICROSOFT_CLIENT_SECRET=your-app-secret
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://grantcue.com/api/oauth/microsoft/callback
```

**OAuth Scopes**:
- `ChannelMessage.Send` - Send messages to channels

### Sending Messages

```typescript
async function sendTeamsNotification(
  orgId: string,
  title: string,
  message: string,
  actionUrl?: string
) {
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('org_id', orgId)
    .eq('integration_type', 'microsoft_teams')
    .eq('is_active', true)
    .single();

  if (!integration) return;

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: title,
              weight: 'Bolder',
              size: 'Medium'
            },
            {
              type: 'TextBlock',
              text: message,
              wrap: true
            }
          ],
          actions: actionUrl ? [
            {
              type: 'Action.OpenUrl',
              title: 'View Details',
              url: actionUrl
            }
          ] : []
        }
      }
    ]
  };

  await fetch(integration.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card)
  });
}
```

## Custom Webhooks

### Purpose

Allow users to integrate GrantCue with custom systems or services via HTTP webhooks.

### Database Schema

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,  -- Optional signing secret
  events TEXT[] NOT NULL,  -- e.g., ['grant.saved', 'grant.deadline_approaching']
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  total_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES webhooks(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT
);
```

### Supported Events

| Event | Description |
|-------|-------------|
| `grant.saved` | Grant added to pipeline |
| `grant.updated` | Grant information updated |
| `grant.deleted` | Grant removed from pipeline |
| `grant.status_changed` | Grant status changed |
| `grant.deadline_approaching` | Deadline within X days |
| `grant.deadline_passed` | Deadline has passed |
| `task.created` | Task created |
| `task.assigned` | Task assigned to user |
| `task.completed` | Task marked complete |
| `comment.created` | Comment added |
| `mention.created` | User mentioned in comment |

### Creating a Webhook

**API**: `POST /api/webhooks`

```typescript
const webhook = {
  org_id: currentOrg.id,
  name: 'My Custom Integration',
  url: 'https://myapp.com/webhooks/grantcue',
  secret: 'my-signing-secret',  // Optional
  events: ['grant.saved', 'grant.deadline_approaching']
};

const response = await fetch('/api/webhooks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(webhook)
});
```

### Webhook Delivery

```typescript
async function triggerWebhook(
  eventType: string,
  payload: any,
  orgId: string
) {
  // Get active webhooks for this event type
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .contains('events', [eventType]);

  for (const webhook of webhooks) {
    try {
      // Generate signature if secret provided
      const signature = webhook.secret
        ? generateHMAC(webhook.secret, JSON.stringify(payload))
        : undefined;

      // Send webhook
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GrantCue-Event': eventType,
          'X-GrantCue-Signature': signature || '',
          'User-Agent': 'GrantCue-Webhooks/1.0'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      // Log delivery
      await supabase.from('webhook_deliveries').insert({
        webhook_id: webhook.id,
        event_type: eventType,
        payload,
        response_status: response.status,
        response_body: await response.text()
      });

      // Update webhook stats
      await supabase
        .from('webhooks')
        .update({
          last_triggered_at: new Date(),
          total_deliveries: webhook.total_deliveries + 1
        })
        .eq('id', webhook.id);

    } catch (error) {
      // Log failed delivery
      await supabase.from('webhook_deliveries').insert({
        webhook_id: webhook.id,
        event_type: eventType,
        payload,
        error_message: error.message
      });

      // Update failure count
      await supabase
        .from('webhooks')
        .update({
          failed_deliveries: webhook.failed_deliveries + 1
        })
        .eq('id', webhook.id);

      // Disable webhook after 10 consecutive failures
      if (webhook.failed_deliveries + 1 >= 10) {
        await supabase
          .from('webhooks')
          .update({ is_active: false })
          .eq('id', webhook.id);
      }
    }
  }
}
```

### Webhook Signature Verification

Recipients can verify webhook authenticity using the signature:

```typescript
// Recipient's server
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express.js example
app.post('/webhooks/grantcue', (req, res) => {
  const signature = req.headers['x-grantcue-signature'];
  const isValid = verifyWebhookSignature(
    JSON.stringify(req.body),
    signature,
    process.env.WEBHOOK_SECRET
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook
  const { event, data } = req.body;
  console.log(`Received ${event}:`, data);

  res.status(200).send('OK');
});
```

## Calendar Feed (ICS)

### Purpose

Provide a public ICS feed URL that can be subscribed to from any calendar application.

### Implementation

Each organization gets a unique calendar feed token.

**URL Format**:
```
https://grantcue.com/api/calendar/{orgId}/{token}.ics
```

**Endpoint**: `/api/calendar/[orgId]/[token].ts`

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { orgId, token } = req.query;

  // Verify token
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('ics_token')
    .eq('org_id', orgId)
    .single();

  if (!settings || settings.ics_token !== token) {
    return res.status(404).send('Not found');
  }

  // Get grants with deadlines
  const { data: grants } = await supabase
    .from('org_grants_saved')
    .select('*')
    .eq('org_id', orgId)
    .not('close_date', 'is', null)
    .order('close_date', { ascending: true });

  // Generate ICS file
  const ics = generateICS(grants);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="grantcue-deadlines.ics"');
  res.send(ics);
}

function generateICS(grants: Grant[]): string {
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GrantCue//Grant Deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:GrantCue Deadlines',
    'X-WR-TIMEZONE:America/New_York'
  ];

  for (const grant of grants) {
    const uid = `grant-${grant.id}@grantcue.com`;
    const dtstart = formatICSDate(grant.close_date);

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${uid}`);
    ics.push(`DTSTAMP:${formatICSDate(new Date())}`);
    ics.push(`DTSTART;VALUE=DATE:${dtstart}`);
    ics.push(`SUMMARY:Grant Deadline: ${escapeICS(grant.title)}`);
    ics.push(`DESCRIPTION:${escapeICS(grant.description || '')}`);
    ics.push(`URL:https://grantcue.com/grants/${grant.id}`);
    ics.push('END:VEVENT');
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}
```

## Email Service (Resend)

### Purpose

Send transactional emails for notifications, invitations, and alerts.

### Configuration

**Environment Variable**:
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### Sending Emails

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  const { data, error } = await resend.emails.send({
    from: 'GrantCue <notifications@grantcue.com>',
    to,
    subject,
    html
  });

  if (error) {
    console.error('Email send error:', error);
    throw error;
  }

  return data;
}

// Deadline reminder email
await sendEmail(
  user.email,
  'Grant Deadline Reminder: Infrastructure Grant 2024',
  `
    <h2>Grant Deadline Reminder</h2>
    <p>The deadline for <strong>${grant.title}</strong> is in 3 days.</p>
    <p><strong>Deadline:</strong> ${formatDate(grant.close_date)}</p>
    <p><a href="https://grantcue.com/grants/${grant.id}">View Grant Details</a></p>
  `
);
```

## Integration Security

### Token Storage

- All OAuth tokens encrypted at rest using AES-256
- Encryption key stored in environment variable
- Never expose tokens in API responses

### Token Encryption

```typescript
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted, authTagHex] = encryptedText.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Webhook Security

1. **Signature Verification**: Use HMAC-SHA256 signatures
2. **HTTPS Only**: Reject non-HTTPS webhook URLs
3. **Timeout**: 10-second request timeout
4. **Rate Limiting**: Max 100 deliveries per minute
5. **Auto-Disable**: Disable after 10 consecutive failures

## Related Documentation

- [System Overview](./system-overview.md)
- [Authentication](./authentication.md)
- [Data Flow](./data-flow.md)
- [Database Schema](../database/schema.md)
