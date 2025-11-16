# Authentication Architecture

## Overview

GrantCue uses a multi-layered authentication system built on Supabase Auth, providing secure user authentication with support for multiple authentication methods, two-factor authentication (2FA), and session management.

## Authentication Methods

### 1. Email/Password Authentication

The primary authentication method for most users.

**Flow**:
```
┌─────────┐         ┌──────────────┐         ┌────────────┐
│  User   │────────>│   Supabase   │────────>│ PostgreSQL │
│ Client  │         │     Auth     │         │  Database  │
└─────────┘         └──────────────┘         └────────────┘
     │                      │                       │
     │ 1. Email/Password    │                       │
     ├─────────────────────>│                       │
     │                      │ 2. Verify Password    │
     │                      ├──────────────────────>│
     │                      │<──────────────────────┤
     │                      │ 3. Create Session     │
     │ 4. JWT + Refresh     │                       │
     │<─────────────────────┤                       │
     │                      │                       │
```

**Implementation**:
```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securePassword123!',
  options: {
    data: {
      full_name: 'John Doe'
    }
  }
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securePassword123!'
});
```

**Security Features**:
- Password hashing using bcrypt (cost factor: 10)
- Minimum password requirements (8 characters)
- Rate limiting on login attempts (5 attempts per 5 minutes)
- Account lockout after failed attempts
- Email verification required for new accounts

### 2. Magic Link Authentication

Passwordless authentication via email links.

**Flow**:
```
┌─────────┐         ┌──────────────┐         ┌────────────┐
│  User   │────────>│   Supabase   │────────>│   Email    │
│ Client  │         │     Auth     │         │  Service   │
└─────────┘         └──────────────┘         └────────────┘
     │                      │                       │
     │ 1. Request Magic Link│                       │
     ├─────────────────────>│                       │
     │                      │ 2. Generate Token     │
     │                      │ 3. Send Email         │
     │                      ├──────────────────────>│
     │                      │                       │
     │ 4. Click Link        │                       │
     ├─────────────────────>│                       │
     │                      │ 5. Verify Token       │
     │ 6. Create Session    │                       │
     │<─────────────────────┤                       │
```

**Implementation**:
```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: 'https://grantcue.com/auth/callback'
  }
});
```

**Security Features**:
- One-time use tokens
- Expiration after 1 hour
- Rate limiting (1 request per minute per email)
- Secure token generation (cryptographically random)

### 3. OAuth Authentication

Third-party authentication via OAuth providers.

**Supported Providers**:
- Google
- GitHub
- Microsoft

**Flow**:
```
┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌────────────┐
│  User   │───>│   Supabase   │───>│  OAuth   │───>│   User     │
│ Client  │    │     Auth     │    │ Provider │    │ Approves   │
└─────────┘    └──────────────┘    └──────────┘    └────────────┘
     │                │                   │                │
     │ 1. Initiate    │                   │                │
     ├───────────────>│                   │                │
     │                │ 2. Redirect       │                │
     │                ├──────────────────>│                │
     │                │                   │ 3. Auth Screen │
     │                │                   ├───────────────>│
     │                │                   │<───────────────┤
     │                │ 4. Auth Code      │                │
     │                │<──────────────────┤                │
     │                │ 5. Exchange Token │                │
     │                ├──────────────────>│                │
     │                │<──────────────────┤                │
     │ 6. Session     │                   │                │
     │<───────────────┤                   │                │
```

**Implementation**:
```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://grantcue.com/auth/callback'
  }
});
```

**Security Features**:
- State parameter prevents CSRF attacks
- PKCE flow for additional security
- Token validation
- Profile information verification

## Two-Factor Authentication (2FA)

TOTP-based two-factor authentication for enhanced security.

### Enrollment Flow

```
┌─────────┐         ┌──────────────┐         ┌────────────┐
│  User   │────────>│   /api/2fa   │────────>│ PostgreSQL │
│ Client  │         │   /enroll    │         │  Database  │
└─────────┘         └──────────────┘         └────────────┘
     │                      │                       │
     │ 1. Request Enroll    │                       │
     ├─────────────────────>│                       │
     │                      │ 2. Generate Secret    │
     │                      │ 3. Create QR Code     │
     │ 4. QR + Backup Codes │                       │
     │<─────────────────────┤                       │
     │                      │                       │
     │ 5. Verify Code       │                       │
     ├─────────────────────>│                       │
     │                      │ 6. Save Secret        │
     │                      ├──────────────────────>│
     │ 7. Confirmation      │                       │
     │<─────────────────────┤                       │
```

**Implementation**:
```typescript
// API: Generate 2FA secret
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const secret = speakeasy.generateSecret({
  name: `GrantCue (${user.email})`
});

const qrCode = await QRCode.toDataURL(secret.otpauth_url);

// Store encrypted secret
await supabase.from('user_2fa').insert({
  user_id: user.id,
  secret: encrypt(secret.base32),
  backup_codes: generateBackupCodes()
});

// Client: Verify code
const token = speakeasy.totp({
  secret: secret.base32,
  encoding: 'base32'
});
```

### Login Flow with 2FA

```
┌─────────┐         ┌──────────────┐         ┌────────────┐
│  User   │────────>│   Supabase   │────────>│ PostgreSQL │
│ Client  │         │     Auth     │         │  Database  │
└─────────┘         └──────────────┘         └────────────┘
     │                      │                       │
     │ 1. Email/Password    │                       │
     ├─────────────────────>│                       │
     │                      │ 2. Check 2FA Enabled  │
     │                      ├──────────────────────>│
     │                      │<──────────────────────┤
     │ 3. 2FA Required      │                       │
     │<─────────────────────┤                       │
     │                      │                       │
     │ 4. TOTP Code         │                       │
     ├─────────────────────>│                       │
     │                      │ 5. Verify Code        │
     │                      ├──────────────────────>│
     │                      │<──────────────────────┤
     │ 6. Full Session      │                       │
     │<─────────────────────┤                       │
```

**Security Features**:
- Time-based codes (30-second window)
- Backup codes for device loss
- Rate limiting on verification attempts
- Encrypted secret storage
- Recovery via email verification

## Session Management

### JWT Token Structure

**Access Token** (short-lived, 1 hour):
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "app_metadata": {},
  "user_metadata": {
    "full_name": "John Doe"
  },
  "iat": 1699999999,
  "exp": 1700003599
}
```

**Refresh Token** (long-lived, 30 days):
- Stored securely in httpOnly cookie (production)
- Used to obtain new access tokens
- Can be revoked

### Token Refresh Flow

```
┌─────────┐         ┌──────────────┐         ┌────────────┐
│ Client  │────────>│   Supabase   │────────>│ PostgreSQL │
│         │         │     Auth     │         │  Database  │
└─────────┘         └──────────────┘         └────────────┘
     │                      │                       │
     │ 1. Access Token      │                       │
     │    Expiring Soon     │                       │
     │                      │                       │
     │ 2. Refresh Token     │                       │
     ├─────────────────────>│                       │
     │                      │ 3. Verify Token       │
     │                      ├──────────────────────>│
     │                      │<──────────────────────┤
     │                      │ 4. Check Revoked      │
     │                      ├──────────────────────>│
     │                      │<──────────────────────┤
     │ 5. New Access Token  │                       │
     │<─────────────────────┤                       │
```

**Implementation**:
```typescript
// Automatic refresh in AuthContext
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
        setSession(session);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);

// Manual refresh
const { data, error } = await supabase.auth.refreshSession();
```

### Session Storage

**Client-side**:
- Access token: Memory (React state)
- Refresh token: httpOnly cookie (secure, SameSite)
- Session metadata: localStorage (non-sensitive)

**Server-side**:
- Sessions tracked in `auth.sessions` table
- Refresh tokens hashed before storage
- Revoked tokens tracked separately

## API Authentication

### Endpoint Authentication Types

#### 1. User Authentication (JWT)

Most API endpoints require user authentication.

**Headers**:
```
Authorization: Bearer <jwt-access-token>
```

**Verification**:
```typescript
import { verifyUserAuth } from './utils/auth-middleware';

const authResult = await verifyUserAuth(req, supabase);
if (!authResult.success) {
  return res.status(401).json({ error: authResult.error });
}

const user = authResult.user!;
```

#### 2. CRON Authentication

Scheduled jobs use secret-based authentication.

**Headers**:
```
Authorization: Bearer <CRON_SECRET>
```

**Verification**:
```typescript
import { verifyCronRequest } from './utils/auth-middleware';

if (!verifyCronRequest(req)) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**Security Requirements**:
- Secret must be ≥32 characters
- Timing-safe comparison
- Rotated every 90 days
- Never committed to version control

#### 3. Token-Based Authentication

Specific features use time-limited tokens.

**Data Export Tokens**:
- Generated on request
- Valid for 7 days
- Single-use recommended

**Calendar Feed Tokens**:
- Organization-specific
- Stored in `organization_settings.ics_token`
- Allow public calendar subscription

**Verification**:
```typescript
// Data export token
const { data } = await supabase
  .from('data_export_tokens')
  .select('*')
  .eq('token', token)
  .eq('used', false)
  .gt('expires_at', new Date().toISOString())
  .single();

if (!data) {
  return res.status(401).json({ error: 'Invalid or expired token' });
}

// Calendar feed token
const { data: org } = await supabase
  .from('organization_settings')
  .select('org_id')
  .eq('ics_token', token)
  .single();
```

## Security Best Practices

### Password Security

1. **Strong Password Requirements**
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character

2. **Password Storage**
   - Never store plaintext passwords
   - Bcrypt hashing (cost factor: 10)
   - Salted hashes

3. **Password Reset**
   - Time-limited reset tokens (1 hour)
   - One-time use tokens
   - Email verification required
   - Old password invalidated

### Token Security

1. **JWT Security**
   - Short expiration (1 hour)
   - Signed with HS256 algorithm
   - Verified on every request
   - Cannot be revoked (use refresh tokens)

2. **Refresh Token Security**
   - Longer expiration (30 days)
   - Stored in httpOnly cookies
   - Can be revoked
   - Rotated on use

3. **API Token Security**
   - Cryptographically random generation
   - Limited scope and permissions
   - Time-limited expiration
   - Audit logging

### Rate Limiting

Prevent brute force and DoS attacks.

**Limits**:
- Login attempts: 5 per 5 minutes (per IP + email)
- Magic link requests: 1 per minute (per email)
- 2FA verification: 5 per 5 minutes (per session)
- API requests: 60 per minute (per user)
- Public endpoints: 100 per minute (per IP)

**Implementation**:
```typescript
import { rateLimitAuth } from './utils/ratelimit';

const rateLimitResult = await rateLimitAuth(req, email);
if (rateLimitResult.limited) {
  return res.status(429).json({
    error: 'Too many requests',
    retryAfter: rateLimitResult.reset
  });
}
```

### Account Security

1. **Account Lockout**
   - After 10 failed login attempts
   - Locked for 30 minutes
   - Email notification sent

2. **Session Security**
   - Invalidate on password change
   - Logout all devices option
   - Suspicious activity detection

3. **Email Verification**
   - Required for new accounts
   - Re-verification on email change
   - Verification link expires in 24 hours

## Organization Auto-Creation

When a user signs up, an organization is automatically created.

**Flow**:
```sql
-- Trigger: on_auth_user_created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function: handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auto_create_organization
CREATE TRIGGER auto_create_organization
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_user_organization();
```

**Implementation**:
```typescript
// In signup API
const { data: user, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name }
  }
});

// Database trigger automatically:
// 1. Creates user_profile
// 2. Creates organization
// 3. Adds user to org_members as admin
// 4. Creates organization_settings
```

## Team Invitations

Users can invite team members to their organization.

**Flow**:
```
┌─────────┐         ┌──────────────┐         ┌────────────┐
│  Admin  │────────>│   /api/team  │────────>│ PostgreSQL │
│  User   │         │  /invite     │         │  Database  │
└─────────┘         └──────────────┘         └────────────┘
     │                      │                       │
     │ 1. Send Invite       │                       │
     ├─────────────────────>│                       │
     │                      │ 2. Check Admin        │
     │                      ├──────────────────────>│
     │                      │ 3. Create Invitation  │
     │                      ├──────────────────────>│
     │                      │ 4. Send Email         │
     │                      │                       │
     │ 5. Confirmation      │                       │
     │<─────────────────────┤                       │
```

**Invitee Accepts**:
```
┌─────────┐         ┌──────────────┐         ┌────────────┐
│ Invitee │────────>│  /api/team   │────────>│ PostgreSQL │
│         │         │  /accept     │         │  Database  │
└─────────┘         └──────────────┘         └────────────┘
     │                      │                       │
     │ 1. Click Link        │                       │
     ├─────────────────────>│                       │
     │                      │ 2. Verify Token       │
     │                      ├──────────────────────>│
     │                      │ 3. Check Expiration   │
     │                      │<──────────────────────┤
     │                      │ 4. Add to org_members │
     │                      ├──────────────────────>│
     │                      │ 5. Mark Accepted      │
     │                      ├──────────────────────>│
     │ 6. Redirect to App   │                       │
     │<─────────────────────┤                       │
```

**Security**:
- Invitations expire after 7 days
- Only org admins can send invitations
- Invitations can be revoked
- Email verification required

## Logout & Session Termination

### Standard Logout

```typescript
// Client logout
await supabase.auth.signOut();

// Effects:
// 1. Invalidates refresh token
// 2. Clears client-side session
// 3. Removes cookies
// 4. Redirects to login
```

### Logout All Devices

```typescript
// Revoke all refresh tokens for user
const { error } = await supabase.rpc('revoke_all_sessions', {
  user_id: user.id
});

// User must re-authenticate on all devices
```

### Automatic Logout

- Inactivity timeout: 30 days (refresh token expiration)
- Token expiration: 1 hour (access token)
- Browser close: Session persists (via refresh token)

## Error Handling

### Common Authentication Errors

| Error | Status | Description |
|-------|--------|-------------|
| `invalid_credentials` | 401 | Wrong email or password |
| `email_not_confirmed` | 401 | Email verification required |
| `user_not_found` | 404 | User does not exist |
| `2fa_required` | 401 | 2FA verification needed |
| `invalid_token` | 401 | JWT token invalid or expired |
| `rate_limit_exceeded` | 429 | Too many requests |
| `account_locked` | 403 | Account locked due to failed attempts |

### Error Response Format

```json
{
  "error": "invalid_credentials",
  "message": "The email or password you entered is incorrect",
  "statusCode": 401
}
```

## Related Documentation

- [System Overview](./system-overview.md)
- [Permissions (RBAC)](./permissions.md)
- [Data Flow](./data-flow.md)
- [Database Schema](../database/schema.md)
