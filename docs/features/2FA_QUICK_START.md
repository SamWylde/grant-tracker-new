# 2FA Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Set Environment Variable
```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
echo "ENCRYPTION_KEY=<your-generated-key>" >> .env
```

### Step 2: Run Database Migration
```bash
# The migration file is ready at:
# supabase/migrations/20250204_add_two_factor_authentication.sql

# Apply via Supabase Dashboard or CLI:
supabase db push
```

### Step 3: Test the Implementation
1. Navigate to `/settings` (create route if needed)
2. Click "Enable Two-Factor Authentication"
3. Scan QR code with Google Authenticator or Authy
4. Save your backup codes
5. Sign out and test login with 2FA

---

## 📦 What's Included

### Backend (7 files)
- ✅ `/api/2fa/setup.ts` - Initialize 2FA setup
- ✅ `/api/2fa/verify-setup.ts` - Verify and enable 2FA
- ✅ `/api/2fa/verify.ts` - Verify 2FA during login
- ✅ `/api/2fa/status.ts` - Get 2FA status
- ✅ `/api/2fa/disable.ts` - Disable 2FA
- ✅ `/api/2fa/regenerate-backup-codes.ts` - Regenerate backup codes
- ✅ `/api/2fa/org-settings.ts` - Manage org enforcement

### Frontend (5 files)
- ✅ `/src/components/2fa/TwoFactorSetup.tsx` - Setup UI
- ✅ `/src/components/2fa/TwoFactorManagement.tsx` - Management UI
- ✅ `/src/components/2fa/TwoFactorVerify.tsx` - Verification UI
- ✅ `/src/components/2fa/OrganizationSecuritySettings.tsx` - Org settings
- ✅ `/src/components/2fa/index.ts` - Barrel export

### Utilities (3 files)
- ✅ `/src/lib/crypto.ts` - Encryption utilities
- ✅ `/src/lib/twoFactor.ts` - 2FA operations
- ✅ `/src/hooks/use2FA.ts` - React hooks

### Pages (1 file)
- ✅ `/src/pages/SettingsPage.tsx` - Settings page with 2FA

### Database (1 file)
- ✅ `/supabase/migrations/20250204_add_two_factor_authentication.sql`

---

## 🔑 Key Features

### For Users
- TOTP-based 2FA (Google Authenticator, Authy, etc.)
- QR code setup + manual entry option
- 10 backup codes for recovery
- Easy enable/disable (if not required by org)
- Backup code regeneration

### For Organizations
- Require 2FA for admins
- Require 2FA for all members
- Adoption tracking and statistics
- Compliance monitoring

### Security
- AES-256-GCM encryption for secrets
- SHA-256 hashing for backup codes
- Rate limiting (5 attempts, 15-min lockout)
- Complete audit logging
- Clock skew tolerance (±30 seconds)

---

## 🔗 Integration Example

### Add Settings Route
```tsx
// In App.tsx
import { SettingsPage } from './pages/SettingsPage';

<Route path="/settings" element={
  <ProtectedRoute>
    <SettingsPage />
  </ProtectedRoute>
} />
```

### Use in Login Flow
```tsx
import { TwoFactorVerify } from './components/2fa';
import { check2FARequired } from './hooks/use2FA';

// After password login:
const needs2FA = await check2FARequired(user.id);

if (needs2FA) {
  // Show 2FA verification
  return (
    <TwoFactorVerify
      userId={user.id}
      onSuccess={() => {
        // Complete login
      }}
    />
  );
}
```

### Organization Settings
```tsx
import { OrganizationSecuritySettings } from './components/2fa';

<OrganizationSecuritySettings orgId={currentOrgId} />
```

---

## 📋 Required Environment Variables

```bash
# Required
ENCRYPTION_KEY=<64-character-hex-string>

# Already configured (Supabase)
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
```

---

## ✅ Testing Checklist

- [ ] Install authenticator app (Google Authenticator/Authy)
- [ ] Set `ENCRYPTION_KEY` in environment
- [ ] Run database migration
- [ ] Test 2FA setup flow
- [ ] Test login with TOTP code
- [ ] Test login with backup code
- [ ] Test backup code regeneration
- [ ] Test 2FA disable
- [ ] Test rate limiting (5 failed attempts)
- [ ] Test organization enforcement
- [ ] Download and verify documentation

---

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid code" | Check device time sync, wait for new code |
| "Too many attempts" | Wait 15 minutes or use backup code |
| QR won't scan | Use manual entry option |
| Lost authenticator | Use backup code to sign in |
| Can't disable 2FA | Organization requires it (contact admin) |

---

## 📚 Full Documentation

See `TWO_FACTOR_AUTHENTICATION.md` for complete documentation including:
- Detailed API reference
- Database schema details
- Security implementation
- User guides
- Advanced troubleshooting

---

## 🎯 Next Steps

1. **For Development:**
   - Add route to Settings page
   - Test all flows
   - Customize UI as needed
   - Add 2FA requirement to login flow

2. **For Production:**
   - Backup encryption key securely
   - Test recovery scenarios
   - Document support procedures
   - Train support team

3. **For Organizations:**
   - Announce 2FA availability
   - Set enforcement policies
   - Communicate deadlines
   - Monitor adoption

---

**Need Help?** Check `TWO_FACTOR_AUTHENTICATION.md` or contact support.
