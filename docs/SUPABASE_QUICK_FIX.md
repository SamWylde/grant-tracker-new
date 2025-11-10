# 🚨 Quick Fix: Supabase Email Redirect Issue

**Problem:** Confirmation emails redirect to `localhost:3000` causing `access_denied` errors.

## ⚡ 5-Minute Fix

### 1. Fix Redirect URLs (Most Important!)

Go to Supabase Dashboard → **Authentication** → **URL Configuration**

**Set Site URL:**
```
https://www.grantcue.com
```

**Add to Redirect URLs:**
```
https://www.grantcue.com/**
https://grantcue.com/**
http://localhost:5173/**
http://localhost:3000/**
```

> **Note:** The `**` wildcard is critical - it allows all paths under the domain.

### 2. Update Vercel Environment Variables

**Add/Update these in Vercel Dashboard:**

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VITE_APP_URL` | `https://www.grantcue.com` |

> **Critical:** Use `VITE_` prefix, NOT `NEXT_PUBLIC_`

### 3. Redeploy

After changing environment variables:
```bash
git push
```

Or manually redeploy in Vercel dashboard.

### 4. Test

1. Sign up with a NEW email address
2. Check email - should see "Welcome to GrantCue!"
3. Click confirmation link
4. Should redirect to `https://www.grantcue.com/discover`
5. ✅ No more errors!

---

## Still Having Issues?

### Check Supabase Auth Logs
1. Supabase Dashboard → **Logs**
2. Filter by: **Auth**
3. Look for recent verification attempts

### Common Mistakes

❌ **Wrong:** `NEXT_PUBLIC_SUPABASE_URL`
✅ **Correct:** `VITE_SUPABASE_URL`

❌ **Wrong:** `https://www.grantcue.com/*` (single asterisk)
✅ **Correct:** `https://www.grantcue.com/**` (double asterisk)

❌ **Wrong:** Site URL set to `http://localhost:3000`
✅ **Correct:** Site URL set to production domain

---

## Email Template Preview

After you update templates, your emails will look like:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Welcome to GrantCue! 🎉

Thanks for signing up!

[Confirm Email Address]

What's next?
• Search 1000s of grants
• Save to pipeline
• Track deadlines

The GrantCue Team
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

See full templates in: `docs/SUPABASE_EMAIL_SETUP.md`

---

## Need Help?

📖 Full documentation: `docs/SUPABASE_EMAIL_SETUP.md`
💬 Supabase Discord: https://discord.supabase.com
🐛 Report issues: Create GitHub issue
