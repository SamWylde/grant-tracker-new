# Information Disclosure Security Fix Summary

## Overview
Fixed information disclosure vulnerabilities across 50+ API endpoints that were exposing sensitive internal details in error responses.

## Issues Fixed

### 1. Error Message Exposure
**Problem**: Endpoints were returning raw `error.message` values that could expose:
- Database column names and table structures
- Internal file paths
- Stack traces
- Implementation details
- Constraint names and database schema information

**Solution**: Created `sanitizeError()` utility function that:
- Logs full error details server-side for debugging
- Returns only safe, generic messages to clients
- Strips database column names, file paths, and stack traces
- Provides user-friendly messages based on error type
- In production, returns completely generic messages

### 2. Database Error Code Exposure
**Problem**: Endpoints were exposing `error.code` and `error.hint` from PostgreSQL
**Solution**: Removed exposure; mapped error codes to safe messages internally

### 3. Detailed Error Context
**Problem**: Error responses included `details` field with raw error messages
**Solution**: All details now sanitized through `sanitizeError()`

## Files Modified

### 2FA Endpoints (7 files)
- ✅ api/2fa/setup.ts
- ✅ api/2fa/verify.ts
- ✅ api/2fa/verify-setup.ts
- ✅ api/2fa/disable.ts
- ✅ api/2fa/regenerate-backup-codes.ts
- ✅ api/2fa/status.ts
- ✅ api/2fa/org-settings.ts

### Grants Endpoints (6 files)
- ✅ api/grants/custom.ts
- ✅ api/grants/details.ts
- ✅ api/grants/search.ts
- ✅ api/grants/nofo-summary.ts
- ✅ api/grants/fetch-pdf.ts
- ✅ api/grants/search-catalog.ts

### Documents Endpoints (5 files)
- ✅ api/documents/upload.ts
- ✅ api/documents/download.ts
- ✅ api/documents/delete.ts
- ✅ api/documents/list.ts
- ✅ api/documents/quota.ts

### Core API Endpoints (15 files)
- ✅ api/tasks.ts
- ✅ api/contacts.ts
- ✅ api/funders.ts
- ✅ api/funder-interactions.ts
- ✅ api/saved.ts
- ✅ api/saved-status.ts
- ✅ api/approval-requests.ts
- ✅ api/approval-workflows.ts
- ✅ api/notifications.ts
- ✅ api/activity.ts
- ✅ api/alerts.ts
- ✅ api/budgets.ts
- ✅ api/compliance.ts
- ✅ api/disbursements.ts
- ✅ api/payment-schedules.ts

### Admin Endpoints (6 files)
- ✅ api/admin/organizations.ts
- ✅ api/admin/users.ts
- ✅ api/admin/update-plan.ts
- ✅ api/admin/update-username.ts
- ✅ api/admin/update-org-name.ts
- ✅ api/admin/fix-grant-titles.ts

### Additional Endpoints (12 files)
- ✅ api/import.ts
- ✅ api/views.ts
- ✅ api/scheduled-reports.ts
- ✅ api/recent-searches.ts
- ✅ api/openai-proxy.ts
- ✅ api/metrics.ts
- ✅ api/data-export/request.ts
- ✅ api/data-export/download.ts
- ✅ api/reports/generate-content.ts
- ✅ api/reports/agency-program-breakdown.ts
- ✅ api/calendar/[orgId]/[token].ts
- ✅ api/utils/notifications.ts

## Utility Function Created

**File**: `/api/utils/error-handler.ts`

Added `sanitizeError()` function with the following features:

### Security Features:
1. **Removes database column references**: `column "user_id"` → `field`
2. **Removes constraint names**: `constraint "users_pkey"` → `constraint`
3. **Removes file paths**: `/api/tasks.ts:123` → `[file]`
4. **Removes stack traces**: All `at SomeFunction (...)` removed
5. **Maps error codes to safe messages**:
   - `23505` → "This item already exists"
   - `23503` → "Cannot perform operation due to existing dependencies"
   - `PGRST116` → "Resource not found"
6. **Pattern-based detection**:
   - JWT/token errors → "Authentication failed"
   - Quota errors → "Storage quota exceeded"
   - Timeout errors → "Request timeout - please try again"
7. **Production mode**: Returns completely generic messages in production

### Logging Preserved:
- All errors still logged server-side with full details via `console.error()`
- Context strings added for easier debugging (e.g., `sanitizeError(error, 'creating task')`)
- Original error objects preserved in server logs

## Statistics

- **Total endpoints fixed**: 50+
- **Total issues resolved**: 51 individual error disclosure points
- **Files modified**: 51 API endpoint files + 1 utility file
- **Error patterns eliminated**:
  - ❌ `error.message` exposures: 0 remaining
  - ❌ `error.code`, `error.hint` exposures: 0 remaining  
  - ❌ `details: error.message`: 0 remaining
  - ✅ All errors now sanitized

## Before & After Example

### Before (Information Disclosure):
```json
{
  "error": "Failed to create task",
  "details": "null value in column \"org_id\" violates not-null constraint",
  "code": "23502",
  "hint": "Failing row contains (123, null, ...)"
}
```

### After (Sanitized):
```json
{
  "error": "Required field is missing"
}
```

**Server logs still contain full details:**
```
[tasks API] Full error details: {
  code: '23502',
  message: 'null value in column "org_id" violates not-null constraint',
  details: 'Failing row contains (123, null, ...)',
  stack: '...'
}
```

## Testing Recommendations

1. **Verify client-side error handling** still works with generic messages
2. **Check server logs** contain full error details for debugging
3. **Test in production mode** to ensure completely generic messages
4. **Verify database constraint violations** return user-friendly messages
5. **Test authentication errors** don't reveal user existence

## Security Benefits

1. **Prevents database schema enumeration**: Attackers can't discover table/column names
2. **Prevents path disclosure**: Internal file structure not exposed
3. **Prevents implementation detail leakage**: Error messages don't reveal tech stack
4. **Maintains debugging capability**: Server-side logs preserved
5. **Compliance friendly**: Helps meet security audit requirements
