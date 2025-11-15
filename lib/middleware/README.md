# Security Headers Middleware

Comprehensive security headers implementation for the GrantCue application.

## Overview

This middleware provides three layers of security header protection:

1. **Production (Vercel)**: Headers configured in `vercel.json` apply to all routes
2. **API Routes**: Programmatic middleware for additional API-specific headers
3. **Development**: Headers configured in `vite.config.ts` for local development

## Security Headers Implemented

### X-Frame-Options: DENY
Prevents the application from being embedded in iframes, protecting against clickjacking attacks.

### X-Content-Type-Options: nosniff
Prevents browsers from MIME-sniffing responses, reducing exposure to drive-by download attacks.

### Strict-Transport-Security
Forces browsers to use HTTPS for all connections for 1 year (including subdomains).

### Referrer-Policy: strict-origin-when-cross-origin
Controls how much referrer information is shared with external sites.

### Permissions-Policy
Disables potentially sensitive browser features:
- Camera
- Microphone
- Geolocation
- Payment APIs

### Content-Security-Policy (CSP)
Comprehensive policy that:
- Allows scripts only from self and necessary CDNs (Vercel Analytics)
- Permits inline styles for React/Mantine components
- Restricts API connections to approved domains (Grants.gov, Supabase, OpenAI)
- Blocks object/embed tags
- Upgrades insecure requests to HTTPS

## Usage

### Option 1: Using the Middleware Wrapper (Recommended)

```typescript
import { withSecurityHeaders } from '../../lib/middleware';
import type { VercelRequest, VercelResponse } from '@vercel/node';

async function handler(req: VercelRequest, res: VercelResponse) {
  // Your API logic here
  return res.status(200).json({ data: [] });
}

export default withSecurityHeaders(handler);
```

### Option 2: Applying Headers Directly

```typescript
import { applySecurityHeaders } from '../../lib/middleware';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res);

  // Your API logic here
  return res.status(200).json({ data: [] });
}
```

### Option 3: API-Specific Headers (JSON Only)

For API endpoints that only return JSON, use stricter headers:

```typescript
import { applyApiSecurityHeaders } from '../../lib/middleware';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res);

  return res.status(200).json({ data: [] });
}
```

### Custom CSP Configuration

```typescript
import { withSecurityHeaders } from '../../lib/middleware';
import type { VercelRequest, VercelResponse } from '@vercel/node';

async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ data: [] });
}

export default withSecurityHeaders(handler, {
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'",
  customHeaders: {
    'X-Custom-Header': 'value',
  },
});
```

## Testing Security Headers

### Production (after deployment)

```bash
# Test all security headers
curl -I https://your-domain.vercel.app/

# Test specific API endpoint
curl -I https://your-domain.vercel.app/api/grants/search
```

### Development

```bash
# Start dev server
yarn dev

# In another terminal, test headers
curl -I http://localhost:5173/
```

### Expected Headers

You should see all of these headers in the response:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Content-Security-Policy: default-src 'self'; ...
```

## Security Considerations

### CSP Inline Scripts/Styles
The current CSP allows `unsafe-inline` for scripts and styles. This is necessary for:
- React's inline styles
- Mantine UI component styles
- Vite's hot module replacement (development)

To improve security, consider:
1. Moving inline scripts to external files
2. Using nonces for necessary inline scripts
3. Implementing a stricter CSP in production

### Third-Party Services
The CSP explicitly allows connections to:
- `api.grants.gov` - Federal grants API
- `*.supabase.co` - Database and authentication
- `api.openai.com` - AI features
- `vercel.live` - Vercel Analytics
- `fonts.googleapis.com` / `fonts.gstatic.com` - Google Fonts

Review and update these domains if services change.

### HSTS Considerations
The HSTS header forces HTTPS for 1 year. Ensure:
1. SSL certificates are properly configured
2. All subdomains support HTTPS (or remove `includeSubDomains`)
3. You're ready to commit to HTTPS-only

## Files Modified

- `/vercel.json` - Production security headers for all routes
- `/vite.config.ts` - Development server security headers
- `/lib/middleware/security-headers.ts` - Reusable middleware functions
- `/lib/middleware/index.ts` - Middleware exports

## Further Reading

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Web Docs: CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Vercel Security Headers](https://vercel.com/docs/concepts/edge-network/headers)
