# Rate Limiting Implementation

## Overview

Rate limiting has been implemented using Upstash Redis to protect API endpoints from abuse and ensure fair usage across all users.

## Configuration

### Environment Variables

Add the following to your `.env` file (see `.env.example` for reference):

```bash
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
```

**Note:** Rate limiting is optional. If these environment variables are not configured, the endpoints will work without rate limiting (useful for development).

### Getting Upstash Credentials

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database
3. Copy the REST API URL and Token from the database details
4. Add them to your `.env` file

## Rate Limit Tiers

| Tier | Limit | Endpoints |
|------|-------|-----------|
| **PUBLIC** | 100 req/min per IP | Search, check-user |
| **AUTH** | 10 req/min per IP | 2FA operations |
| **STANDARD** | 60 req/min per IP | General authenticated endpoints |
| **ADMIN** | 30 req/min per IP | Admin operations |

## Protected Endpoints

### Public Endpoints (100 req/min)
- `/api/grants/search` - Grant search
- `/api/auth/check-user` - User existence check

### Auth Endpoints (10 req/min)
- `/api/2fa/setup` - 2FA setup
- `/api/2fa/verify` - 2FA verification during login
- `/api/2fa/verify-setup` - 2FA setup verification
- `/api/2fa/disable` - 2FA disable
- `/api/2fa/regenerate-backup-codes` - Regenerate backup codes

### Standard Endpoints (60 req/min)
- `/api/oauth/google/callback` - Google OAuth callback
- `/api/oauth/slack/callback` - Slack OAuth callback
- `/api/oauth/microsoft/callback` - Microsoft OAuth callback
- `/api/data-export/request` - Data export request (GDPR)
- `/api/documents/upload` - Document upload

### Admin Endpoints (30 req/min)
- `/api/admin/sync` - Grant sync operations
- `/api/admin/users` - User management
- `/api/admin/organizations` - Organization management
- `/api/admin/fix-grant-titles` - Fix grant titles
- `/api/admin/update-org-name` - Update organization name
- `/api/admin/update-plan` - Update subscription plan
- `/api/admin/update-username` - Update username

## Implementation Details

### Rate Limit Utility

The rate limiting utility is located at `/api/utils/ratelimit.ts` and provides:

1. **Four rate limiter functions:**
   - `rateLimitPublic()` - 100 req/min
   - `rateLimitAuth()` - 10 req/min
   - `rateLimitStandard()` - 60 req/min
   - `rateLimitAdmin()` - 30 req/min

2. **Helper functions:**
   - `handleRateLimit()` - Handles rate limit response
   - `setRateLimitHeaders()` - Sets rate limit headers

### Usage Example

```typescript
import { rateLimitPublic, handleRateLimit } from '../utils/ratelimit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply rate limiting
  const rateLimitResult = await rateLimitPublic(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return; // Rate limit exceeded, response already sent
  }

  // ... rest of your handler code
}
```

### Response Format

When rate limit is exceeded, the API returns:

```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 42
}
```

With HTTP status `429 Too Many Requests` and headers:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining in window
- `X-RateLimit-Reset` - Timestamp when limit resets
- `Retry-After` - Seconds until retry is allowed

## Security Features

1. **IP-based tracking** - Rate limits are enforced per IP address
2. **Sliding window** - Uses sliding window algorithm for accurate rate limiting
3. **Fail-open design** - If Redis is unavailable, requests are allowed (prevents service disruption)
4. **X-Forwarded-For support** - Correctly handles proxied requests
5. **Analytics** - Built-in analytics for monitoring rate limit usage

## Testing

To test rate limiting in development:

1. Set up Upstash Redis and configure environment variables
2. Make repeated requests to a protected endpoint
3. Verify you receive 429 status after exceeding the limit
4. Check the `Retry-After` header to know when to retry

Example using curl:

```bash
# Make 101 requests to exceed public limit (100/min)
for i in {1..101}; do
  curl -X POST http://localhost:3000/api/grants/search \
    -H "Content-Type: application/json" \
    -d '{"keyword":"health"}' \
    -w "Status: %{http_code}\n"
done
```

## Monitoring

Monitor rate limiting via:

1. **Application logs** - Check for rate limit warnings
2. **Upstash Dashboard** - View Redis analytics
3. **API response headers** - Check `X-RateLimit-*` headers

## Future Enhancements

Consider implementing:

1. **User-based rate limiting** - Different limits for authenticated users vs anonymous
2. **Plan-based limits** - Higher limits for premium users
3. **Endpoint-specific overrides** - Custom limits for specific endpoints
4. **Rate limit notifications** - Alert admins when limits are frequently hit
5. **Whitelist/blacklist** - IP-based whitelist for trusted sources

## Total Endpoints Protected

**19 endpoints** across 4 tiers have rate limiting protection.

## Compliance

This implementation helps meet security requirements for:
- API abuse prevention
- DDoS mitigation
- Fair usage enforcement
- Infrastructure protection

---

**Last Updated:** November 15, 2025
**Implemented By:** Rate Limiting Infrastructure - Days 5-7
