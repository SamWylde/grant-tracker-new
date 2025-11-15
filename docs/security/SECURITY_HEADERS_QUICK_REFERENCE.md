# Security Headers - Quick Reference Card

## TL;DR

✅ **Security headers are ALREADY ACTIVE** on all routes via `vercel.json`
✅ **No action required** for existing API routes
✅ **Optional**: Add middleware for defense-in-depth on critical routes

---

## For New API Routes

### Option 1: Wrapper (Recommended)

```typescript
import { withSecurityHeaders } from '../../lib/middleware';

async function handler(req, res) {
  return res.json({ data: [] });
}

export default withSecurityHeaders(handler);
```

### Option 2: Direct Application

```typescript
import { applySecurityHeaders } from '../../lib/middleware';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  return res.json({ data: [] });
}
```

### Option 3: API-Only (Stricter)

```typescript
import { applyApiSecurityHeaders } from '../../lib/middleware';

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);
  return res.json({ data: [] });
}
```

---

## Headers Applied

| Header | Value |
|--------|-------|
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Strict-Transport-Security | max-age=31536000; includeSubDomains |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=() |
| Content-Security-Policy | See vercel.json |

---

## Testing

```bash
# Development
yarn dev
curl -I http://localhost:5173/

# Production (after deployment)
curl -I https://your-domain.vercel.app/

# Run tests
npx tsx lib/middleware/__test-middleware.js
```

---

## Troubleshooting

### CSP Blocking Resources?

1. Open DevTools Console
2. Look for CSP violation errors
3. Update CSP in `vercel.json` (line 32)
4. Add domain to appropriate directive

### Headers Not Showing?

- **Dev**: Restart server, clear cache
- **Prod**: Redeploy, wait for CDN cache clear

---

## Security Score

After deployment, test at:
- https://securityheaders.com/

Expected: **A** or **A+**

---

## Files

- **Config**: `/vercel.json`, `/vite.config.ts`
- **Middleware**: `/lib/middleware/security-headers.ts`
- **Docs**: `/lib/middleware/README.md`
- **Examples**: `/SECURITY_HEADERS_USAGE_EXAMPLE.md`
- **Full Report**: `/SECURITY_HEADERS_IMPLEMENTATION.md`

---

## Quick Validation

```bash
# Validate vercel.json
node -e "require('./vercel.json')"

# Type check
npx tsc --noEmit lib/middleware/security-headers.ts

# Test middleware
npx tsx lib/middleware/__test-middleware.js
```

---

**Need Help?** See `/lib/middleware/README.md` for detailed documentation.
