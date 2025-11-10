# Supabase Email Configuration Guide

This guide explains how to fix email confirmation redirects and customize email templates for GrantCue.

## Problem 1: Confirmation Links Redirect to Localhost

### Issue
Supabase confirmation emails contain links like:
```
https://YOUR-PROJECT.supabase.co/auth/v1/verify?token=...&redirect_to=http://localhost:3000
```

This causes `access_denied` and `otp_expired` errors in production because:
1. The link redirects to localhost instead of your production URL
2. Users can't access localhost from their email client
3. The token expires before reaching your frontend

### Solution: Configure Supabase URL Settings

#### Step 1: Update Site URL (Primary Fix)

1. Go to your Supabase Dashboard
2. Navigate to: **Authentication** → **URL Configuration**
3. Set **Site URL** to your production domain:
   ```
   https://www.grantcue.com
   ```

This is the default redirect when no explicit `redirect_to` is provided.

#### Step 2: Add Allowed Redirect URLs

In the same **URL Configuration** page, add these to **Redirect URLs**:

```
http://localhost:5173/*
http://localhost:5173/**
http://localhost:3000/*
http://localhost:3000/**
https://www.grantcue.com/*
https://www.grantcue.com/**
https://grantcue.com/*
https://grantcue.com/**
```

**Important**: The `*` and `**` wildcards allow all paths under each domain.

#### Step 3: Verify Environment Variables

Make sure your Vercel environment variables are set:

**Production Environment Variables:**
```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=https://www.grantcue.com
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Local Development (.env):**
```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173
```

#### Step 4: Update Signup Code (if needed)

If you're using custom signup code, make sure it includes the redirect:

```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/discover`,
  },
});
```

#### Step 5: Test the Flow

1. **Clear browser cache** or use incognito mode
2. Sign up with a new email address
3. Check your email - the link should now redirect to production
4. Click the confirmation link
5. Should redirect to: `https://www.grantcue.com/discover`

---

## Problem 2: Generic Email Templates

### Issue
Default Supabase emails say:
- "Confirm your signup"
- "Follow this link to confirm your user:"
- Generic, unbranded, unprofessional

### Solution: Branded Email Templates

#### Confirmation Email Template

1. Go to Supabase Dashboard
2. Navigate to: **Authentication** → **Email Templates**
3. Select: **"Confirm signup"**
4. Replace with:

```html
<h2>Welcome to GrantCue! 🎉</h2>

<p>Thanks for signing up! We're excited to help you discover and manage federal grant opportunities.</p>

<p>Click the button below to confirm your email address and get started:</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td align="center">
      <a href="{{ .ConfirmationURL }}"
         style="display: inline-block;
                padding: 14px 28px;
                background-color: #228be6;
                color: #ffffff;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;">
        Confirm Email Address
      </a>
    </td>
  </tr>
</table>

<p style="margin-top: 24px;">Or copy and paste this URL into your browser:</p>
<p style="color: #868e96; font-size: 12px; word-break: break-all;">{{ .ConfirmationURL }}</p>

<hr style="border: none; border-top: 1px solid #e9ecef; margin: 32px 0;">

<p style="color: #868e96; font-size: 12px; line-height: 1.6;">
  <strong>What's next?</strong><br>
  Once confirmed, you'll be able to:<br>
  • Search 1000s of federal grants from Grants.gov<br>
  • Save grants to your pipeline<br>
  • Track deadlines and tasks<br>
  • Collaborate with your team
</p>

<p style="margin-top: 24px; color: #868e96; font-size: 11px;">
  This link expires in 24 hours. If you didn't create an account with GrantCue, you can safely ignore this email.
</p>

<p style="margin-top: 32px; color: #495057; font-size: 13px;">
  Thanks,<br>
  <strong>The GrantCue Team</strong><br>
  <a href="https://www.grantcue.com" style="color: #228be6; text-decoration: none;">www.grantcue.com</a>
</p>
```

#### Magic Link Email Template

1. In the same **Email Templates** section
2. Select: **"Magic Link"**
3. Replace with:

```html
<h2>Sign in to GrantCue 🔐</h2>

<p>You requested a magic link to sign in to your account. Click the button below to continue:</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td align="center">
      <a href="{{ .ConfirmationURL }}"
         style="display: inline-block;
                padding: 14px 28px;
                background-color: #228be6;
                color: #ffffff;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;">
        Sign In to GrantCue
      </a>
    </td>
  </tr>
</table>

<p style="margin-top: 24px;">Or copy and paste this URL into your browser:</p>
<p style="color: #868e96; font-size: 12px; word-break: break-all;">{{ .ConfirmationURL }}</p>

<hr style="border: none; border-top: 1px solid #e9ecef; margin: 32px 0;">

<p style="color: #868e96; font-size: 12px; line-height: 1.6;">
  <strong>Why magic links?</strong><br>
  Magic links are more secure than passwords because:<br>
  • No password to remember or type<br>
  • Can't be phished or stolen<br>
  • One-time use only
</p>

<p style="margin-top: 24px; color: #868e96; font-size: 11px;">
  This link expires in 60 minutes. If you didn't request this email, you can safely ignore it - your account is secure.
</p>

<p style="margin-top: 32px; color: #495057; font-size: 13px;">
  Thanks,<br>
  <strong>The GrantCue Team</strong><br>
  <a href="https://www.grantcue.com" style="color: #228be6; text-decoration: none;">www.grantcue.com</a>
</p>
```

#### Password Reset Email Template

1. Select: **"Reset Password"**
2. Replace with:

```html
<h2>Reset Your Password 🔑</h2>

<p>Someone requested a password reset for your GrantCue account. If this was you, click the button below to reset your password:</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td align="center">
      <a href="{{ .ConfirmationURL }}"
         style="display: inline-block;
                padding: 14px 28px;
                background-color: #228be6;
                color: #ffffff;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;">
        Reset Password
      </a>
    </td>
  </tr>
</table>

<p style="margin-top: 24px;">Or copy and paste this URL into your browser:</p>
<p style="color: #868e96; font-size: 12px; word-break: break-all;">{{ .ConfirmationURL }}</p>

<hr style="border: none; border-top: 1px solid #e9ecef; margin: 32px 0;">

<p style="margin-top: 24px; color: #c92a2a; font-size: 12px; background: #ffe0e0; padding: 12px; border-radius: 4px;">
  <strong>⚠️ Security Alert</strong><br>
  If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
</p>

<p style="margin-top: 24px; color: #868e96; font-size: 11px;">
  This link expires in 60 minutes.
</p>

<p style="margin-top: 32px; color: #495057; font-size: 13px;">
  Thanks,<br>
  <strong>The GrantCue Team</strong><br>
  <a href="https://www.grantcue.com" style="color: #228be6; text-decoration: none;">www.grantcue.com</a>
</p>
```

---

## Testing Checklist

After making these changes:

### ✅ Redirect Testing
- [ ] Sign up with a new email
- [ ] Check email arrives with new template
- [ ] Click confirmation link
- [ ] Verify redirects to `https://www.grantcue.com/discover`
- [ ] Confirm no `access_denied` error

### ✅ Magic Link Testing
- [ ] Go to sign-in page
- [ ] Click "Magic Link" tab
- [ ] Enter email and submit
- [ ] Check email for magic link
- [ ] Click link
- [ ] Verify redirects to production and signs in

### ✅ Local Development
- [ ] Sign up from localhost
- [ ] Confirm still works in development
- [ ] Magic link works from localhost

---

## Common Issues

### Issue: Still getting localhost redirects
**Solution**: Make sure you've set the Site URL in Supabase Dashboard, not just environment variables.

### Issue: "Invalid redirect URL" error
**Solution**: Double-check your Redirect URLs list includes the production domain with wildcards.

### Issue: Email template not updating
**Solution**:
1. Clear browser cache
2. Sign out of Supabase Dashboard
3. Sign back in and try again
4. Test with a brand new email address

### Issue: OTP still expiring
**Solution**: This might be a timing issue. The default OTP expiry is:
- Signup: 24 hours
- Magic Link: 60 minutes
- Password Reset: 60 minutes

You can't change these in the UI, but you can contact Supabase support to increase them.

---

## Additional Configuration

### Email Rate Limiting

Supabase has rate limits on emails:
- **Free tier**: 4 emails per hour per user
- **Pro tier**: Higher limits

If users aren't receiving emails, check the rate limits.

### Custom SMTP (Optional)

For production, consider using custom SMTP for better deliverability:

1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Enable custom SMTP
3. Configure with your email provider (SendGrid, AWS SES, etc.)
4. Test thoroughly before going live

### Email Deliverability Tips

1. **Add SPF/DKIM records** - Improves email deliverability
2. **Use custom domain** - Looks more professional
3. **Test with multiple email providers** - Gmail, Outlook, Yahoo, etc.
4. **Check spam folder** - Especially during testing
5. **Warm up your domain** - Send gradually increasing volumes

---

## Support

If you're still having issues:

1. **Check Supabase Logs**: Dashboard → Logs → Auth Logs
2. **Check Browser Console**: Look for errors
3. **Check Network Tab**: See what redirect URLs are being sent
4. **Supabase Discord**: Great community support
5. **Supabase GitHub Issues**: Report bugs

---

## Summary

**Critical Settings:**
1. ✅ Site URL: `https://www.grantcue.com`
2. ✅ Redirect URLs: Include production + localhost with wildcards
3. ✅ Environment variables: `VITE_APP_URL` set correctly
4. ✅ Email templates: Use branded HTML above

**After setup:**
- Users should receive professional, branded emails
- Confirmation links should redirect to production
- No more `access_denied` or `otp_expired` errors
- Smooth sign-up and magic link experience

---

*Last updated: 2025-01-10*
