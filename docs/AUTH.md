# Authentication & Authorization Model

This document describes the authentication and authorization patterns used in the GrantCue API.

## Table of Contents

1. [Overview](#overview)
2. [Authentication Types](#authentication-types)
3. [Authorization Levels](#authorization-levels)
4. [Endpoint Classification](#endpoint-classification)
5. [Security Best Practices](#security-best-practices)
6. [Implementation Guide](#implementation-guide)

## Overview

The GrantCue API uses multiple authentication patterns to secure different types of endpoints:

- **User Authentication**: JWT tokens from Supabase Auth for user-facing endpoints
- **CRON Authentication**: Secret-based authentication for scheduled jobs
- **Token Authentication**: Time-limited tokens for specific features (data exports, calendar feeds)
- **Public Endpoints**: Rate-limited endpoints that don't require authentication

## Authentication Types

### 1. User Authentication (JWT)

Most API endpoints require user authentication via JWT tokens provided by Supabase Auth.

**How it works:**
1. User logs in via Supabase Auth
2. Client receives a JWT token
3. Client includes token in `Authorization: Bearer <token>` header
4. API verifies token and extracts user identity

**Example:**
```typescript
import { verifyUserAuth } from './utils/auth-middleware';

const authResult = await verifyUserAuth(req, supabase);
if (!authResult.success) {
  return res.status(authResult.statusCode || 401).json({ error: authResult.error });
}
const user = authResult.user!;
```

### 2. CRON Authentication

CRON jobs authenticate using a secret token stored in the `CRON_SECRET` environment variable.

**How it works:**
1. CRON scheduler includes `Authorization: Bearer <CRON_SECRET>` header
2. API verifies using timing-safe comparison to prevent timing attacks
3. CRON jobs have elevated privileges (service-role access)

**Security Requirements:**
- Secret must be at least 32 characters long
- Secret must be cryptographically random
- Secret should be rotated every 90 days
- Secret must never be committed to version control

**Example:**
```typescript
import { verifyCronRequest } from './utils/auth-middleware';

if (!verifyCronRequest(req)) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### 3. Token-Based Authentication

Some features use time-limited tokens for specific purposes:

**Data Export Tokens:**
- Generated when user requests data export
- Valid for 7 days
- Single-use or limited-use
- Cannot be used to access other user data

**Calendar Feed Tokens:**
- Organization-specific ICS tokens
- Stored in `organization_settings.ics_token`
- Allow public calendar subscription without authentication
- Scoped to specific organization's grants only

### 4. Public Endpoints

Some endpoints are intentionally public but include rate limiting and other protections:

- Grant search (`/api/grants/search`) - Public grant discovery
- User check (`/api/auth/check-user`) - Generic response to prevent user enumeration
- OAuth callbacks - Handle third-party authentication flows

## Authorization Levels

Beyond authentication, the API implements role-based access control (RBAC):

### Organization Membership

Users must be members of an organization to access its data.

**Roles:**
- **Admin**: Full access to organization data and settings
- **Member**: Can view and edit grants, tasks, and comments
- **Viewer**: Read-only access to organization data

**Example:**
```typescript
import { verifyOrgMembership, verifyOrgAdmin } from './utils/auth-middleware';

// Verify membership (any role)
const membershipResult = await verifyOrgMembership(supabase, user.id, orgId);
if (!membershipResult.success) {
  return res.status(membershipResult.statusCode || 403).json({ error: membershipResult.error });
}

// Verify admin access (for sensitive operations)
const adminResult = await verifyOrgAdmin(supabase, user.id, orgId);
if (!adminResult.success) {
  return res.status(adminResult.statusCode || 403).json({ error: adminResult.error });
}
```

### Platform Admin

Platform administrators have elevated privileges across all organizations.

**Use cases:**
- System-wide user management
- Organization management
- Debug and support operations

**Example:**
```typescript
import { verifyPlatformAdmin } from './utils/auth-middleware';

const adminResult = await verifyPlatformAdmin(supabase, user.id);
if (!adminResult.success || !adminResult.isPlatformAdmin) {
  return res.status(403).json({ error: 'Platform admin access required' });
}
```

## Endpoint Classification

### Protected Endpoints (User Auth Required)

**User Data & Preferences:**
- `/api/notifications` - User notifications
- `/api/data-export/request` - Request personal data export
- `/api/2fa/*` - Two-factor authentication management

**Organization Data (Membership Required):**
- `/api/saved` - Saved grants
- `/api/tasks` - Grant tasks
- `/api/grants/custom` - Custom grants
- `/api/comments/*` - Comments
- `/api/documents/*` - Document management
- `/api/metrics` - Organization metrics
- `/api/reports/*` - Report generation
- `/api/team-performance` - Team performance data
- `/api/activity` - Activity logs
- `/api/budgets` - Budget tracking
- `/api/disbursements` - Disbursement tracking
- `/api/compliance` - Compliance tracking
- `/api/funders` - Funder management
- `/api/contacts` - Contact management
- `/api/mentions` - Mention notifications
- `/api/approval-requests` - Approval workflows
- `/api/approval-workflows` - Workflow management
- `/api/recent-searches` - Search history
- `/api/scheduled-reports` - Report scheduling
- `/api/views` - Custom views

**Organization Admin Only:**
- `/api/integrations` - Third-party integrations (POST/PATCH/DELETE)
- `/api/webhooks` - Webhook management (POST/PATCH/DELETE)
- `/api/2fa/org-settings` - Organization 2FA settings

**Platform Admin Only:**
- `/api/admin/users` - System-wide user management
- `/api/admin/organizations` - Organization management
- `/api/admin/update-plan` - Update subscription plans
- `/api/admin/update-username` - Modify user details
- `/api/admin/update-org-name` - Modify organization details
- `/api/admin/fix-grant-titles` - Data cleanup operations
- `/api/admin/sync` - Manual data synchronization

### CRON-Only Endpoints

**Scheduled Jobs:**
- `/api/cron/check-deadlines` - Check for deadline notifications
- `/api/cron/sync-grants` - Sync grants from external sources
- `/api/cron/send-deadline-reminders` - Send deadline reminder emails
- `/api/cron/send-scheduled-reports` - Send scheduled reports

### Mixed Auth Endpoints

**User OR CRON:**
- `/api/reports/generate-content` - Generate report content (preview or scheduled)

### Token-Based Endpoints

**Special Token Auth:**
- `/api/data-export/download?token=<token>` - Download data export
- `/api/calendar/[orgId]/[token]` - Subscribe to grant deadlines calendar

### Public Endpoints

**No Auth Required (Rate Limited):**
- `/api/grants/search` - Search public grants from Grants.gov
- `/api/auth/check-user` - Check if user exists (generic response)
- `/api/oauth/*/authorize` - OAuth authorization initiation
- `/api/oauth/*/callback` - OAuth callback handlers

## Security Best Practices

### 1. Always Verify Authentication

Never process requests without verifying authentication first:

```typescript
// ❌ BAD - processes request before auth check
const { org_id } = req.body;
const authResult = await verifyUserAuth(req, supabase);

// ✅ GOOD - auth check before any processing
const authResult = await verifyUserAuth(req, supabase);
if (!authResult.success) {
  return sendAuthError(res, authResult);
}
const { org_id } = req.body;
```

### 2. Use Proper HTTP Status Codes

- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Authenticated but insufficient permissions
- `405 Method Not Allowed` - HTTP method not supported

### 3. Don't Leak Information

Avoid revealing whether resources exist to unauthorized users:

```typescript
// ❌ BAD - reveals resource existence
if (!grant) {
  return res.status(404).json({ error: 'Grant not found' });
}
if (!isMember) {
  return res.status(403).json({ error: 'Not a member' });
}

// ✅ GOOD - consistent error message
if (!grant || !isMember) {
  return res.status(404).json({ error: 'Grant not found' });
}
```

### 4. Log Authentication Failures

Log failed authentication attempts for security monitoring:

```typescript
if (!authResult.success) {
  console.warn(`[Auth] Failed auth attempt from IP ${req.headers['x-forwarded-for']}`);
  return sendAuthError(res, authResult);
}
```

### 5. Use Timing-Safe Comparisons

Always use timing-safe comparisons for secrets:

```typescript
import { timingSafeEqual } from 'crypto';

// ❌ BAD - vulnerable to timing attacks
if (authHeader === expectedSecret) { }

// ✅ GOOD - timing-safe comparison
if (timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedSecret))) { }
```

### 6. Rotate Secrets Regularly

- CRON_SECRET: Rotate every 90 days
- ICS tokens: Generate new tokens when compromised
- Data export tokens: Automatic expiration (7 days)

### 7. Apply Rate Limiting

All endpoints should have appropriate rate limiting:

```typescript
import { rateLimitStandard, handleRateLimit } from './utils/ratelimit';

const rateLimitResult = await rateLimitStandard(req);
if (handleRateLimit(res, rateLimitResult)) {
  return;
}
```

Rate limit tiers:
- **Public endpoints**: 100 req/min per IP
- **Standard endpoints**: 60 req/min per IP
- **Admin endpoints**: 30 req/min per IP

## Implementation Guide

### Quick Start Template

Here's a template for implementing authentication in a new endpoint:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  verifyUserAuth,
  verifyOrgMembership,
  sendAuthError,
} from './utils/auth-middleware';
import { rateLimitStandard, handleRateLimit } from './utils/ratelimit';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Apply rate limiting
  const rateLimitResult = await rateLimitStandard(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

  // 2. Check HTTP method
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Verify environment configuration
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 4. Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 5. Verify user authentication
  const authResult = await verifyUserAuth(req, supabase);
  if (!authResult.success) {
    return sendAuthError(res, authResult);
  }
  const user = authResult.user!;

  try {
    // 6. Get parameters
    const { org_id } = req.method === 'GET' ? req.query : req.body;

    if (!org_id || typeof org_id !== 'string') {
      return res.status(400).json({ error: 'org_id is required' });
    }

    // 7. Verify organization membership
    const membershipResult = await verifyOrgMembership(supabase, user.id, org_id);
    if (!membershipResult.success) {
      return sendAuthError(res, membershipResult);
    }

    // 8. Process the request
    // ... your business logic here ...

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in API endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

### Testing Authentication

When testing endpoints, ensure you test:

1. **No authentication**: Should return 401
2. **Invalid token**: Should return 401
3. **Valid user, wrong org**: Should return 403
4. **Insufficient role**: Should return 403
5. **Valid authentication**: Should succeed

Example test cases:

```typescript
// Test 1: No authentication
const response1 = await fetch('/api/endpoint', { method: 'GET' });
expect(response1.status).toBe(401);

// Test 2: Invalid token
const response2 = await fetch('/api/endpoint', {
  headers: { Authorization: 'Bearer invalid_token' }
});
expect(response2.status).toBe(401);

// Test 3: Valid user, wrong org
const response3 = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { Authorization: `Bearer ${validToken}` },
  body: JSON.stringify({ org_id: 'wrong_org' })
});
expect(response3.status).toBe(403);

// Test 4: Valid authentication
const response4 = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { Authorization: `Bearer ${validToken}` },
  body: JSON.stringify({ org_id: userOrgId })
});
expect(response4.status).toBe(200);
```

## Migration Checklist

When adding authentication to an existing endpoint:

- [ ] Add rate limiting
- [ ] Verify user authentication
- [ ] Check organization membership (if applicable)
- [ ] Verify role requirements (if applicable)
- [ ] Add proper error handling
- [ ] Add security logging
- [ ] Update this documentation
- [ ] Add tests for auth cases
- [ ] Review for information leakage
- [ ] Check for timing attack vulnerabilities

## Support

For questions about authentication:
- Review this documentation
- Check `/api/utils/auth-middleware.ts` for implementation details
- Review existing endpoints for reference patterns
- Consult the security team for sensitive operations
