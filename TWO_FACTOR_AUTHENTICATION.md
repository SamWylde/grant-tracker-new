# Two-Factor Authentication (2FA) Implementation Guide

## Overview

This document provides a comprehensive guide to the Two-Factor Authentication (2FA) implementation for the GrantCue application. The implementation uses TOTP (Time-based One-Time Password) with backup codes for account recovery and includes organization-level enforcement capabilities.

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [Security Measures](#security-measures)
8. [Testing Guide](#testing-guide)
9. [User Documentation](#user-documentation)
10. [Troubleshooting](#troubleshooting)

---

## Features

### Core Features
- ✅ **TOTP-based 2FA** - Compatible with Google Authenticator, Authy, 1Password, etc.
- ✅ **QR Code Setup** - Easy setup by scanning a QR code
- ✅ **Manual Entry** - Alternative setup method for devices that can't scan QR codes
- ✅ **Backup Codes** - 10 single-use recovery codes generated at setup
- ✅ **Backup Code Regeneration** - Users can regenerate backup codes when needed
- ✅ **Organization Enforcement** - Admins can require 2FA for admins or all members
- ✅ **Rate Limiting** - Protection against brute force attacks (5 attempts, 15-minute lockout)
- ✅ **Audit Logging** - Complete audit trail of all 2FA events
- ✅ **Encrypted Storage** - TOTP secrets encrypted using AES-256-GCM

### Security Features
- ✅ **Encrypted TOTP secrets** - All secrets encrypted at rest
- ✅ **Hashed backup codes** - Backup codes stored as SHA-256 hashes
- ✅ **Rate limiting** - Prevents brute force attacks
- ✅ **Audit logging** - Tracks all 2FA-related events
- ✅ **Session management** - Proper session handling with 2FA
- ✅ **Clock skew tolerance** - ±30 seconds window for TOTP verification

---

## Architecture

### Technology Stack
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Frontend**: React with Mantine UI
- **Encryption**: Node.js crypto module (AES-256-GCM)
- **TOTP**: Speakeasy library
- **QR Codes**: qrcode library

### Data Flow

```
User Setup Flow:
1. User initiates 2FA setup
2. Server generates TOTP secret
3. Server encrypts secret and stores in database
4. Server generates QR code and backup codes
5. User scans QR code with authenticator app
6. User enters verification code
7. Server verifies code and enables 2FA
8. User saves backup codes

User Login Flow:
1. User enters email and password
2. If 2FA is enabled, show 2FA verification page
3. User enters TOTP code or backup code
4. Server verifies code
5. If valid, complete login
6. If backup code used, mark as used
```

---

## Setup Instructions

### 1. Environment Variables

Add the following environment variable to your `.env` file:

```bash
# Encryption key for TOTP secrets (generate a random 32-character string)
ENCRYPTION_KEY=your-32-character-random-encryption-key-here
```

**Generate a secure encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Database Migration

Run the database migration to create the required tables:

```bash
# The migration file is located at:
# supabase/migrations/20250204_add_two_factor_authentication.sql

# If using Supabase CLI:
supabase db push

# Or apply manually through Supabase dashboard
```

### 3. Install Dependencies

The required npm packages should already be installed. If not:

```bash
npm install speakeasy qrcode @types/speakeasy @types/qrcode
```

### 4. Update Database Types

After running the migration, regenerate TypeScript types:

```bash
# If using Supabase CLI:
supabase gen types typescript --local > src/lib/database.types.ts
```

### 5. Add Route for Settings Page

Add the settings page route to your `App.tsx`:

```tsx
import { SettingsPage } from './pages/SettingsPage';

// In your routes:
<Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
```

---

## Database Schema

### Tables Created

#### 1. `user_profiles` (Extended)
New columns added:
- `totp_secret` (TEXT) - Encrypted TOTP secret
- `totp_enabled` (BOOLEAN) - Whether 2FA is enabled
- `totp_verified_at` (TIMESTAMPTZ) - When 2FA was verified
- `failed_2fa_attempts` (INTEGER) - Failed attempt counter
- `last_failed_2fa_attempt` (TIMESTAMPTZ) - Last failed attempt timestamp
- `last_2fa_success` (TIMESTAMPTZ) - Last successful verification

#### 2. `user_backup_codes` (New)
Stores hashed backup codes:
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to auth.users
- `code_hash` (TEXT) - SHA-256 hash of backup code
- `used` (BOOLEAN) - Whether code has been used
- `used_at` (TIMESTAMPTZ) - When code was used
- `used_from_ip` (TEXT) - IP address where code was used
- `created_at` (TIMESTAMPTZ) - Creation timestamp

#### 3. `two_factor_audit_log` (New)
Audit trail for 2FA events:
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to auth.users
- `event_type` (TEXT) - Event type (setup, verify_success, verify_fail, etc.)
- `event_details` (JSONB) - Additional event details
- `ip_address` (TEXT) - IP address
- `user_agent` (TEXT) - User agent string
- `created_at` (TIMESTAMPTZ) - Event timestamp

#### 4. `organization_settings` (Extended)
New columns added:
- `require_2fa_for_admins` (BOOLEAN) - Require 2FA for admins
- `require_2fa_for_all` (BOOLEAN) - Require 2FA for all members

### Helper Functions

The migration creates several PostgreSQL functions:

1. `user_has_2fa_enabled(user_id)` - Check if user has 2FA enabled
2. `user_requires_2fa(user_id)` - Check if user is required to have 2FA
3. `increment_failed_2fa_attempts(user_id)` - Increment failed attempt counter
4. `reset_failed_2fa_attempts(user_id)` - Reset failed attempt counter
5. `count_unused_backup_codes(user_id)` - Count remaining backup codes

---

## API Endpoints

### 1. POST `/api/2fa/setup`
Initialize 2FA setup for authenticated user.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP",
  "backupCodes": [
    "ABCD-1234",
    "EFGH-5678",
    ...
  ],
  "message": "Scan the QR code..."
}
```

### 2. POST `/api/2fa/verify-setup`
Verify TOTP code and enable 2FA.

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Two-factor authentication has been successfully enabled!"
}
```

### 3. POST `/api/2fa/verify`
Verify 2FA code during login.

**Headers:**
- `Authorization: Bearer <token>` (optional for login flow)

**Body:**
```json
{
  "code": "123456",
  "userId": "uuid" // Optional, can be derived from token
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "isBackupCode": false
}
```

### 4. GET `/api/2fa/status`
Get 2FA status for current user.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "enabled": true,
  "verifiedAt": "2025-02-04T10:00:00Z",
  "backupCodesRemaining": 8,
  "requiredByOrg": true,
  "organizations": [
    {
      "name": "My Organization",
      "role": "admin",
      "requires2FA": true
    }
  ]
}
```

### 5. POST `/api/2fa/disable`
Disable 2FA for current user.

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Two-factor authentication has been disabled."
}
```

### 6. POST `/api/2fa/regenerate-backup-codes`
Generate new backup codes.

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "backupCodes": [
    "WXYZ-9876",
    "QRST-5432",
    ...
  ],
  "message": "New backup codes generated. Save them in a secure place!"
}
```

### 7. GET/POST `/api/2fa/org-settings`
Manage organization 2FA enforcement.

**GET - Query Parameters:**
- `orgId` - Organization ID

**POST - Headers:**
- `Authorization: Bearer <token>`

**POST - Body:**
```json
{
  "orgId": "uuid",
  "require2FAForAdmins": true,
  "require2FAForAll": false
}
```

**Response:**
```json
{
  "orgId": "uuid",
  "require2FAForAdmins": true,
  "require2FAForAll": false,
  "memberStats": {
    "total": 10,
    "admins": 3,
    "with2FA": 7,
    "adminsWith2FA": 3
  }
}
```

---

## Frontend Components

### 1. `TwoFactorSetup`
Component for setting up 2FA.

**Usage:**
```tsx
import { TwoFactorSetup } from '../components/2fa';

<TwoFactorSetup
  onSetupComplete={() => {
    // Handle setup completion
  }}
  onCancel={() => {
    // Handle cancellation
  }}
/>
```

**Features:**
- Displays QR code for scanning
- Shows manual entry secret
- Backup codes display and download
- Verification code input

### 2. `TwoFactorManagement`
Component for managing 2FA settings.

**Usage:**
```tsx
import { TwoFactorManagement } from '../components/2fa';

<TwoFactorManagement />
```

**Features:**
- View 2FA status
- Enable/disable 2FA
- Regenerate backup codes
- View remaining backup codes
- Organization requirements display

### 3. `TwoFactorVerify`
Component for verifying 2FA during login.

**Usage:**
```tsx
import { TwoFactorVerify } from '../components/2fa';

<TwoFactorVerify
  userId={userId}
  onSuccess={() => {
    // Handle successful verification
  }}
  onCancel={() => {
    // Handle cancellation
  }}
/>
```

**Features:**
- TOTP code input
- Backup code option
- Rate limit warnings
- Remaining attempts display

### 4. `OrganizationSecuritySettings`
Component for org-level 2FA enforcement.

**Usage:**
```tsx
import { OrganizationSecuritySettings } from '../components/2fa';

<OrganizationSecuritySettings orgId={orgId} />
```

**Features:**
- Toggle 2FA requirements
- View adoption statistics
- Compliance tracking

### 5. Custom Hook: `use2FAStatus`
Hook for accessing 2FA status.

**Usage:**
```tsx
import { use2FAStatus } from '../hooks/use2FA';

const { status, loading, error, refetch } = use2FAStatus();

if (status?.enabled) {
  // 2FA is enabled
}
```

---

## Security Measures

### 1. Encryption
- **Algorithm**: AES-256-GCM
- **Key Derivation**: scrypt with random salt
- **Secret Storage**: TOTP secrets encrypted before database storage
- **Backup Codes**: Stored as SHA-256 hashes (one-way)

### 2. Rate Limiting
- **Max Attempts**: 5 failed attempts
- **Lockout Duration**: 15 minutes
- **Reset**: Automatic after successful verification
- **Tracking**: Per-user attempt counter with timestamp

### 3. Audit Logging
All 2FA events are logged:
- Setup initiation
- Successful/failed verifications
- 2FA disable events
- Backup code usage
- Backup code regeneration

### 4. Session Management
- 2FA verification required for each new session
- JWT tokens include 2FA verification status
- Proper session invalidation on logout

### 5. Input Validation
- TOTP codes: 6 digits only
- Backup codes: Alphanumeric with optional dashes
- Rate limit checks before verification
- Encrypted data validation

---

## Testing Guide

### Prerequisites

1. **Install Authenticator App**
   - Google Authenticator (iOS/Android)
   - Authy (iOS/Android/Desktop)
   - 1Password (with TOTP support)
   - Microsoft Authenticator

2. **Test Account**
   - Create a test user account
   - Ensure you have admin access for testing org settings

### Test Cases

#### 1. Setup 2FA
1. Navigate to Settings page (`/settings`)
2. Click "Enable Two-Factor Authentication"
3. Scan QR code with authenticator app
4. Verify the secret is added to your app
5. Enter the 6-digit code from app
6. Verify you see backup codes
7. Download backup codes
8. Confirm setup completion

**Expected Results:**
- QR code displays correctly
- Secret can be manually entered
- Verification succeeds with valid code
- 10 backup codes are generated
- Backup codes can be downloaded
- 2FA status shows as "Enabled"

#### 2. Login with 2FA
1. Sign out of your account
2. Sign in with email/password
3. Verify 2FA prompt appears
4. Enter code from authenticator app
5. Verify successful login

**Expected Results:**
- 2FA verification page displays
- Valid code allows login
- Invalid code shows error
- Rate limiting works after 5 failed attempts

#### 3. Use Backup Code
1. Sign out
2. Sign in with email/password
3. Click "Use a backup code instead"
4. Enter one of your backup codes
5. Verify successful login
6. Check that backup code count decreased

**Expected Results:**
- Backup code option works
- Code is accepted (with or without dash)
- Code is marked as used
- Remaining count is accurate
- Warning if last code used

#### 4. Regenerate Backup Codes
1. Go to Settings
2. Click "Regenerate Backup Codes"
3. Enter verification code
4. Save new backup codes
5. Verify old codes no longer work

**Expected Results:**
- New codes are generated
- Old codes are invalidated
- New codes work for login
- Count resets to 10

#### 5. Disable 2FA
1. Go to Settings
2. Click "Disable 2FA"
3. Enter verification code
4. Confirm disabling

**Expected Results:**
- Requires verification code
- All data is removed (secret, backup codes)
- 2FA status shows as "Disabled"
- Can sign in without 2FA

#### 6. Organization Enforcement
1. As org admin, go to org settings
2. Enable "Require 2FA for Admins"
3. As admin without 2FA, try to access admin features
4. Verify 2FA setup is required
5. Set up 2FA
6. Verify access is granted

**Expected Results:**
- Enforcement setting saves correctly
- Users see requirement notice
- Access restricted until 2FA enabled
- Statistics display correctly

#### 7. Rate Limiting
1. Sign out
2. Sign in with email/password
3. Enter wrong code 5 times
4. Verify account is locked
5. Wait 15 minutes
6. Verify can try again

**Expected Results:**
- Attempt counter increments
- Warning appears after 3 failures
- Lockout occurs at 5 failures
- Clear error message with wait time
- Access restored after timeout

### Testing Checklist

- [ ] QR code generation works
- [ ] Manual secret entry works
- [ ] TOTP verification works
- [ ] Backup codes work for login
- [ ] Backup code regeneration works
- [ ] 2FA disable works
- [ ] Rate limiting prevents brute force
- [ ] Audit logs are created
- [ ] Organization enforcement works
- [ ] Mobile responsiveness
- [ ] Error messages are clear
- [ ] Loading states display
- [ ] Success notifications appear

---

## User Documentation

### For End Users

#### How to Enable 2FA

1. **Access Settings**
   - Click your profile in the top right
   - Select "Settings"
   - Go to the "Security" tab

2. **Start Setup**
   - Click "Enable Two-Factor Authentication"
   - Click "Get Started"

3. **Scan QR Code**
   - Open your authenticator app (Google Authenticator, Authy, etc.)
   - Scan the displayed QR code
   - Or manually enter the provided secret key

4. **Verify Setup**
   - Enter the 6-digit code from your app
   - Click "Verify & Enable"

5. **Save Backup Codes**
   - **IMPORTANT**: Save these codes in a secure location
   - Each code can only be used once
   - Download the codes or write them down
   - Store them securely (password manager, safe, etc.)

#### How to Sign In with 2FA

1. Enter your email and password as normal
2. You'll be prompted for a verification code
3. Open your authenticator app
4. Enter the current 6-digit code
5. Click "Verify"

#### Using Backup Codes

If you don't have access to your authenticator app:

1. On the verification screen, click "Use a backup code instead"
2. Enter one of your saved backup codes
3. Click "Verify"
4. **Note**: Each code can only be used once

#### Regenerating Backup Codes

If you've used several codes or lost them:

1. Go to Settings > Security
2. Click "Regenerate Backup Codes"
3. Enter a verification code from your app
4. Save the new codes securely
5. Old codes will no longer work

#### Disabling 2FA

⚠️ **Warning**: Only disable 2FA if absolutely necessary.

1. Go to Settings > Security
2. Click "Disable 2FA"
3. Enter a verification code from your app
4. Confirm disabling

### For Organization Admins

#### Requiring 2FA for Your Organization

1. **Access Organization Settings**
   - Navigate to your organization settings
   - Go to the "Security" section

2. **Enable 2FA Requirements**
   - Toggle "Require 2FA for Admins" to enforce for admins only
   - Toggle "Require 2FA for All Members" to enforce for everyone
   - Settings are saved automatically

3. **Monitor Adoption**
   - View adoption statistics
   - See which users have enabled 2FA
   - Track compliance percentage

4. **Communicate with Team**
   - Notify team members of the requirement
   - Provide setup instructions
   - Set a deadline for compliance

---

## Troubleshooting

### Common Issues

#### 1. "Invalid verification code" error

**Causes:**
- Code expired (TOTP codes change every 30 seconds)
- Phone/computer time is incorrect
- Typing error

**Solutions:**
- Wait for a new code to generate
- Check your device's time settings (ensure automatic time is enabled)
- Try again with the current code
- Use a backup code if available

#### 2. "Too many failed attempts" error

**Cause:**
- Exceeded 5 failed verification attempts

**Solution:**
- Wait 15 minutes for the lockout to expire
- Check device time settings during wait
- Use a backup code if available

#### 3. Lost authenticator app access

**Solutions:**
- Use a backup code to sign in
- Once signed in, set up 2FA again with a new device
- If no backup codes available, contact support

#### 4. QR code won't scan

**Solutions:**
- Try the manual entry option
- Copy the secret key and add it manually in your app
- Ensure good lighting and steady camera
- Try a different authenticator app

#### 5. Can't disable 2FA (required by organization)

**Explanation:**
- Your organization requires 2FA for your role
- Contact your organization admin if this is a problem

**Alternative:**
- You can still regenerate backup codes
- You can set up 2FA on a new device

#### 6. Backup codes not working

**Checks:**
- Are you entering the code correctly? (Dashes are optional)
- Has the code already been used?
- Have you regenerated codes recently? (Old codes are invalidated)

**Solution:**
- Check your saved codes carefully
- Try without dashes (e.g., ABCD1234 instead of ABCD-1234)
- If out of valid codes, contact support

### Developer Troubleshooting

#### 1. Encryption errors

**Check:**
- `ENCRYPTION_KEY` environment variable is set
- Key is at least 32 characters
- Key is consistent across deployments

#### 2. Database errors

**Check:**
- Migration has been applied
- All required tables exist
- RLS policies are correctly configured

#### 3. TOTP verification fails consistently

**Check:**
- Server time is synchronized (NTP)
- Clock skew window is set (default ±1 period)
- Secret is correctly encrypted/decrypted

#### 4. Rate limiting not working

**Check:**
- Database functions are created
- `failed_2fa_attempts` counter is incrementing
- Timestamp is being updated

---

## Additional Notes

### Best Practices

1. **For Users:**
   - Use a reliable authenticator app
   - Save backup codes securely (password manager recommended)
   - Keep your device's time synchronized
   - Don't share backup codes
   - Regenerate backup codes if you suspect compromise

2. **For Organizations:**
   - Communicate requirements clearly
   - Provide setup instructions
   - Give adequate notice before enforcement
   - Have a support process for locked-out users
   - Monitor adoption rates

3. **For Developers:**
   - Keep encryption key secure and backed up
   - Monitor audit logs for suspicious activity
   - Test thoroughly before deployment
   - Document any customizations
   - Keep dependencies updated

### Future Enhancements

Potential improvements to consider:

- [ ] SMS/Email backup option
- [ ] WebAuthn/FIDO2 support (hardware keys)
- [ ] Remember device option (reduce 2FA frequency)
- [ ] Admin ability to reset user's 2FA
- [ ] Grace period for org enforcement
- [ ] More detailed audit log querying
- [ ] IP whitelist option
- [ ] Risk-based authentication

---

## Support

For issues or questions:

- **Users**: Contact your organization admin or support@grantcue.com
- **Admins**: Contact support@grantcue.com
- **Developers**: Check GitHub issues or contact the development team

---

## License

This 2FA implementation is part of the GrantCue application and follows the same license terms.

---

**Document Version**: 1.0
**Last Updated**: 2025-02-04
**Author**: GrantCue Development Team
