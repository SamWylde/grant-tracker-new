# Security Headers Implementation - Usage Examples

## Implementation Summary

Security headers have been implemented across three layers:

### 1. Production (Vercel) - `vercel.json`
All routes (pages and API endpoints) automatically receive security headers in production.

### 2. API Middleware - `lib/middleware/security-headers.ts`
Reusable TypeScript middleware for programmatic header application.

### 3. Development Server - `vite.config.ts`
Security headers are applied during local development.

## Quick Start: Updating an Existing API Route

### Before (Example: `/api/grants/search.ts`)

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ... your logic ...

  return res.status(200).json({ data: results });
}
```

### After - Option 1: Using Wrapper (Recommended)

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withSecurityHeaders } from '../../lib/middleware';

async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ... your logic ...

  return res.status(200).json({ data: results });
}

// Wrap the handler with security headers
export default withSecurityHeaders(handler);
```

### After - Option 2: Direct Application

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applySecurityHeaders } from '../../lib/middleware';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Apply security headers at the start
  applySecurityHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ... your logic ...

  return res.status(200).json({ data: results });
}
```

### After - Option 3: API-Only Routes (Stricter CSP)

For routes that ONLY return JSON (no HTML/scripts):

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyApiSecurityHeaders } from '../../lib/middleware';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Apply strict API-only security headers
  applyApiSecurityHeaders(res);

  // ... your logic ...

  return res.status(200).json({ data: results });
}
```

## Testing the Implementation

### 1. Validate Configuration Files

```bash
# Check vercel.json is valid
node -e "require('./vercel.json')"

# Type check middleware
npx tsc --noEmit lib/middleware/security-headers.ts
```

### 2. Test Development Server

```bash
# Start the dev server
yarn dev

# In another terminal, check headers
curl -I http://localhost:5173/

# You should see:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Referrer-Policy: strict-origin-when-cross-origin
# Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
# Content-Security-Policy: ...
```

### 3. Test in Production (After Deployment)

```bash
# Test main page
curl -I https://your-domain.vercel.app/

# Test API endpoint
curl -I https://your-domain.vercel.app/api/grants/search

# Test specific header
curl -I https://your-domain.vercel.app/ | grep "X-Frame-Options"
```

### 4. Browser DevTools Test

1. Open your application in Chrome/Firefox
2. Open DevTools (F12)
3. Go to Network tab
4. Reload the page
5. Click on the document request
6. Check the "Response Headers" section
7. Verify all security headers are present

### 5. Online Security Header Checkers

After deployment, use these tools to validate:

- **SecurityHeaders.com**: https://securityheaders.com/
- **Mozilla Observatory**: https://observatory.mozilla.org/
- **Google Lighthouse**: Built into Chrome DevTools

## Migration Guide

You do NOT need to update existing API routes immediately. The security headers are automatically applied by Vercel via `vercel.json`.

However, for defense in depth, consider updating critical API routes to use the middleware:

### Priority Routes to Update (Recommended)

1. **Authentication Routes**
   - `/api/2fa/*`
   - `/api/auth/*`

2. **Sensitive Data Routes**
   - `/api/admin/*`
   - `/api/data-export/*`

3. **High-Traffic Routes**
   - `/api/grants/search.ts`
   - `/api/grants/details.ts`

### Example: Updating Auth Route

```typescript
// api/2fa/setup.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withSecurityHeaders } from '../../lib/middleware';

async function handler(req: VercelRequest, res: VercelResponse) {
  // Your existing auth logic...
  return res.status(200).json({ qrCode, secret });
}

export default withSecurityHeaders(handler);
```

## Header Descriptions

| Header | Value | Purpose |
|--------|-------|---------|
| **X-Frame-Options** | `DENY` | Prevents clickjacking by blocking iframe embedding |
| **X-Content-Type-Options** | `nosniff` | Prevents MIME-sniffing attacks |
| **Strict-Transport-Security** | `max-age=31536000; includeSubDomains` | Forces HTTPS for 1 year |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Limits referrer info leakage |
| **Permissions-Policy** | `camera=(), microphone=(), geolocation=(), payment=()` | Disables sensitive APIs |
| **Content-Security-Policy** | See below | Prevents XSS and injection attacks |

### Content Security Policy Directives

```
default-src 'self'
  → Only load resources from same origin by default

script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com
  → Scripts from self, Vercel analytics, and inline (for React)

style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
  → Styles from self, Google Fonts, and inline (for Mantine)

font-src 'self' https://fonts.gstatic.com
  → Fonts from self and Google Fonts CDN

img-src 'self' data: https: blob:
  → Images from self, data URIs, HTTPS sources, and blob URLs

connect-src 'self' https://api.grants.gov https://*.supabase.co wss://*.supabase.co https://api.openai.com https://vercel.live https://vitals.vercel-insights.com
  → API calls restricted to approved domains

frame-src 'self'
  → Only allow same-origin iframes

object-src 'none'
  → Block plugins like Flash

base-uri 'self'
  → Restrict base tag to same origin

form-action 'self'
  → Forms can only submit to same origin

upgrade-insecure-requests
  → Automatically upgrade HTTP to HTTPS
```

## Troubleshooting

### Issue: CSP Blocking Resources

If you see CSP violations in the console:

1. Open browser DevTools console
2. Look for CSP violation errors
3. Identify the blocked resource
4. Update the CSP in `vercel.json` or `vite.config.ts`
5. Add the domain to the appropriate directive

### Issue: Headers Not Appearing in Development

Make sure you've:
1. Restarted the dev server after updating `vite.config.ts`
2. Cleared browser cache
3. Checked the correct port (usually 5173)

### Issue: Headers Not Appearing in Production

1. Verify `vercel.json` is committed to git
2. Redeploy the application
3. Clear CDN cache (can take a few minutes)
4. Check headers with `curl -I` instead of browser (browser may cache)

## Next Steps

1. **Test the headers** in development and production
2. **Monitor CSP violations** using browser console or reporting API
3. **Gradually tighten CSP** by removing `unsafe-inline` where possible
4. **Update critical API routes** to use the middleware
5. **Consider adding** `Report-To` header for CSP violation reporting

## Security Score

After deployment, test your security headers at:
- https://securityheaders.com/

Expected score: **A** or **A+**

## Additional Resources

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Vercel Security Headers Documentation](https://vercel.com/docs/concepts/edge-network/headers)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
