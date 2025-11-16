# Data Flow Architecture

## Overview

This document describes how data flows through the GrantCue application, from user interactions to database operations and back. Understanding these flows is essential for debugging, optimization, and feature development.

## Core Data Flows

### 1. User Authentication Flow

```
┌──────────┐         ┌─────────────┐         ┌──────────────┐
│  Client  │────────>│   Supabase  │────────>│  PostgreSQL  │
│  (React) │<────────│    Auth     │<────────│   Database   │
└──────────┘         └─────────────┘         └──────────────┘
```

**Steps**:

1. **Sign In Request**
   - User submits email/password or OAuth
   - Client: `supabase.auth.signInWithPassword()`
   - Supabase Auth validates credentials

2. **Token Generation**
   - Supabase generates JWT access token
   - JWT includes: user_id, email, role, exp
   - Refresh token generated for token renewal

3. **Session Establishment**
   - Client stores tokens in memory
   - AuthContext updates with user data
   - Automatic token refresh before expiration

4. **Organization Loading**
   - Client fetches user's organizations
   - OrganizationContext sets current org
   - Permissions loaded for current org

**Code Example**:
```typescript
// Client-side auth flow
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// JWT automatically included in subsequent requests
const { data: orgs } = await supabase
  .from('org_members')
  .select('org_id, organizations(*)')
  .eq('user_id', user.id);
```

### 2. Grant Discovery Flow

```
┌────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────────┐
│ Client │───>│ /api/    │───>│ Grants.gov  │───>│  Response    │
│        │<───│ grants/  │<───│     API     │<───│  Transform   │
└────────┘    │ search   │    └─────────────┘    └──────────────┘
              └──────────┘
                   │
                   v
              ┌──────────┐
              │ grants_  │
              │ catalog  │
              └──────────┘
```

**Steps**:

1. **Search Request**
   - User enters search criteria
   - Client calls `/api/grants/search`
   - Rate limiting check (100 req/min)

2. **External API Call**
   - API proxies to Grants.gov Search2 API
   - Pagination handled automatically
   - Results filtered by criteria

3. **Data Transformation**
   - Raw XML/JSON converted to standard format
   - Grant titles, agencies, deadlines extracted
   - Additional metadata normalized

4. **Catalog Storage** (for sync operations)
   - Grants stored in `grants_catalog`
   - Deduplication checks performed
   - Sync metadata tracked

5. **Response to Client**
   - Formatted grant list returned
   - TanStack Query caches results
   - UI renders grant cards

**Code Example**:
```typescript
// Client request
const { data } = useQuery({
  queryKey: ['grants', filters],
  queryFn: () => fetch('/api/grants/search', {
    method: 'POST',
    body: JSON.stringify(filters)
  })
});

// API handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Call Grants.gov API
  const response = await fetch('https://www.grants.gov/grantsws/rest/opportunities/search/', {
    method: 'POST',
    body: JSON.stringify(searchCriteria)
  });

  // Transform and return
  const grants = transformGrantsGovResponse(response);
  return res.json(grants);
}
```

### 3. Saving a Grant Flow

```
┌────────┐    ┌──────────┐    ┌──────────────┐    ┌───────────┐
│ Client │───>│ /api/    │───>│ Auth Check   │───>│ RLS Check │
│        │    │ saved    │    │ (JWT)        │    │ (org_id)  │
└────────┘    └──────────┘    └──────────────┘    └───────────┘
                   │                                      │
                   v                                      v
              ┌──────────┐                          ┌──────────┐
              │ Insert   │<─────────────────────────│ Database │
              │ Record   │                          │          │
              └──────────┘                          └──────────┘
                   │
                   v
              ┌──────────┐
              │ Triggers │
              │ Fire     │
              └──────────┘
                   │
                   ├──> Create default tasks
                   ├──> Log activity
                   └──> Check alerts
```

**Steps**:

1. **Client Request**
   - User clicks "Save Grant"
   - Client calls `POST /api/saved`
   - JWT token included in Authorization header

2. **Authentication**
   - API verifies JWT token
   - User identity extracted
   - Session validity confirmed

3. **Authorization**
   - Verify user is member of organization
   - Check `grants:create` permission (RBAC)
   - RLS policies enforced at database level

4. **Database Insert**
   - Grant saved to `org_grants_saved`
   - Unique constraint prevents duplicates
   - Default values applied (status, priority)

5. **Database Triggers**
   - **Create Tasks**: Auto-create default tasks from template
   - **Activity Log**: Record "grant saved" event
   - **Alert Matching**: Check if grant matches alert criteria

6. **Response**
   - Saved grant record returned
   - Client cache updated
   - UI updates optimistically

**Code Example**:
```typescript
// Client mutation
const mutation = useMutation({
  mutationFn: async (grant) => {
    return fetch('/api/saved', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: currentOrg.id,
        external_id: grant.id,
        title: grant.title,
        ...grant
      })
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['saved-grants']);
  }
});

// API handler with RLS
const { data, error } = await supabase
  .from('org_grants_saved')
  .insert({
    org_id,
    external_id,
    title,
    user_id: user.id
  })
  .select()
  .single();
// RLS policy automatically enforces org membership
```

### 4. Real-time Updates Flow

```
┌────────────┐                  ┌──────────────┐
│  Client A  │                  │  Client B    │
│  (User 1)  │                  │  (User 2)    │
└─────┬──────┘                  └──────▲───────┘
      │                                │
      │ 1. Update grant                │ 4. Receive update
      │                                │
      v                                │
┌─────────────┐                        │
│ /api/saved- │                        │
│   status    │                        │
└──────┬──────┘                        │
       │                               │
       │ 2. Database UPDATE            │
       v                               │
┌──────────────┐                       │
│  PostgreSQL  │                       │
│   Database   │                       │
└──────┬───────┘                       │
       │                               │
       │ 3. Realtime broadcast         │
       └───────────────────────────────┘
```

**Steps**:

1. **Client A Update**
   - User updates grant status
   - API endpoint processes update
   - Database record modified

2. **Database Trigger**
   - UPDATE triggers Supabase Realtime
   - Change captured by replication slot
   - RLS filters applied

3. **Realtime Broadcast**
   - Filtered change broadcast to subscribed clients
   - Only clients with org access receive update
   - WebSocket connection used

4. **Client B Update**
   - Receives realtime event
   - Local cache invalidated
   - UI automatically re-renders

**Code Example**:
```typescript
// Client subscription
useEffect(() => {
  const subscription = supabase
    .channel('grants-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'org_grants_saved',
        filter: `org_id=eq.${currentOrg.id}`
      },
      (payload) => {
        // Invalidate cache and refetch
        queryClient.invalidateQueries(['saved-grants']);
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, [currentOrg.id]);
```

### 5. AI Features Flow (Grant Summarization)

```
┌────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Client │───>│ /api/    │───>│ Fetch    │───>│ OpenAI   │
│        │    │ grants/  │    │ NOFO     │    │ API      │
│        │    │ nofo-    │    │ Document │    │          │
│        │    │ summary  │    └──────────┘    └──────────┘
│        │    └────┬─────┘                          │
│        │         │                                │
│        │         │<───────────────────────────────┘
│        │         │
│        │         v
│        │    ┌──────────┐
│        │    │ Store in │
│        │    │ grant_ai │
│        │    │ summaries│
│        │<───└──────────┘
└────────┘
```

**Steps**:

1. **Summary Request**
   - User clicks "Generate AI Summary"
   - Client calls `/api/grants/nofo-summary`
   - Check for cached summary first

2. **NOFO Document Fetch**
   - API fetches NOFO PDF/HTML from Grants.gov
   - Document parsed and text extracted
   - Large documents chunked for processing

3. **OpenAI Processing**
   - Text sent to GPT-4o-mini
   - Structured prompt for key information extraction
   - Sections: Overview, Eligibility, Funding, Timeline, Requirements

4. **Database Storage**
   - Summary stored in `grant_ai_summaries`
   - Linked to saved grant
   - Cached for future requests

5. **Response**
   - Formatted summary returned to client
   - Rendered in dedicated tab
   - Available offline after first fetch

**Code Example**:
```typescript
// API handler
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: 'You are a grant analyst. Summarize NOFOs concisely.'
    },
    {
      role: 'user',
      content: `Summarize this NOFO:\n\n${nofoText}`
    }
  ]
});

const summary = completion.choices[0].message.content;

// Store in database
await supabase.from('grant_ai_summaries').insert({
  grant_id: savedGrantId,
  summary_data: {
    overview: extractedOverview,
    eligibility: extractedEligibility,
    funding: extractedFunding,
    ...
  }
});
```

### 6. Scheduled Job Flow (Nightly Grant Sync)

```
┌──────────┐         ┌──────────┐         ┌──────────────┐
│  Vercel  │────────>│ /api/    │────────>│  Grants.gov  │
│  Cron    │         │ cron/    │         │     API      │
└──────────┘         │ sync-    │         └──────────────┘
                     │ grants   │                │
                     └────┬─────┘                │
                          │                      │
                          v                      v
                     ┌──────────┐         ┌──────────┐
                     │ Process  │────────>│ grants_  │
                     │ Results  │         │ catalog  │
                     └──────────┘         └──────────┘
                          │
                          v
                     ┌──────────┐
                     │ Trigger  │
                     │ Alerts   │
                     └──────────┘
```

**Steps**:

1. **Cron Trigger**
   - Vercel cron triggers at 2 AM daily
   - Request includes `CRON_SECRET` for auth
   - Only one instance runs at a time

2. **Sync Orchestration**
   - Fetch last sync timestamp
   - Query Grants.gov for new/updated grants
   - Paginate through all results

3. **Data Processing**
   - Each grant checked against `grants_catalog`
   - Deduplication logic applied
   - Updates merged with existing records

4. **Database Updates**
   - Bulk insert new grants
   - Update modified grants
   - Track sync job metadata

5. **Alert Matching**
   - New grants checked against alert criteria
   - Matching grants trigger notifications
   - Email/Slack/Teams notifications sent

6. **Cleanup**
   - Old sync job records archived
   - Stale grants marked as closed
   - Performance metrics logged

**Code Example**:
```typescript
// Cron handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify CRON_SECRET
  if (!verifyCronRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Run sync
  const syncService = new SyncService();
  const results = await syncService.syncAllGrants();

  // Check alerts
  await checkAlertsForNewGrants(results.newGrants);

  return res.json({
    success: true,
    newGrants: results.newGrants.length,
    updatedGrants: results.updatedGrants.length
  });
}
```

### 7. Document Upload Flow

```
┌────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Client │───>│ /api/    │───>│ Supabase │───>│ Storage  │
│        │    │documents │    │ Storage  │    │ Bucket   │
│        │    │ /upload  │    └──────────┘    └──────────┘
│        │    └────┬─────┘         │
│        │         │               │
│        │         v               v
│        │    ┌──────────┐    ┌──────────┐
│        │<───│ Insert   │    │ grant_   │
│        │    │ Metadata │───>│documents │
└────────┘    └──────────┘    └──────────┘
```

**Steps**:

1. **File Selection**
   - User selects file (PDF, DOC, etc.)
   - Client validates file type and size
   - File prepared for upload

2. **Upload Request**
   - Client initiates multipart upload
   - JWT token included for auth
   - Progress tracking enabled

3. **Storage Service**
   - Supabase Storage receives file
   - Virus scanning performed
   - File stored in organization bucket

4. **Metadata Storage**
   - Document record created in `grant_documents`
   - Linked to grant and user
   - File path and metadata saved

5. **RLS Enforcement**
   - Storage RLS policies check org membership
   - Only authorized users can access
   - Download URLs are signed

6. **Response**
   - Document URL returned to client
   - UI updates with new document
   - File available for download

**Code Example**:
```typescript
// Client upload
const { data, error } = await supabase.storage
  .from('grant-documents')
  .upload(`${orgId}/${grantId}/${fileName}`, file, {
    cacheControl: '3600',
    upsert: false
  });

// Store metadata
await supabase.from('grant_documents').insert({
  grant_id: grantId,
  org_id: orgId,
  user_id: user.id,
  file_name: fileName,
  file_path: data.path,
  file_size: file.size,
  mime_type: file.type
});
```

## Data Caching Strategy

### Client-side Caching (TanStack Query)

**Cache Keys**:
- `['grants', filters]` - Grant search results
- `['saved-grants', orgId]` - Saved grants list
- `['grant-details', grantId]` - Individual grant details
- `['tasks', grantId]` - Grant tasks
- `['userPermissions', orgId]` - User permissions

**Cache Invalidation**:
- Manual: `queryClient.invalidateQueries()`
- Automatic: Realtime subscriptions
- Time-based: `staleTime` and `cacheTime` settings

**Optimistic Updates**:
```typescript
// Optimistic update example
const mutation = useMutation({
  mutationFn: updateGrantStatus,
  onMutate: async (newStatus) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['saved-grants']);

    // Snapshot previous value
    const previousGrants = queryClient.getQueryData(['saved-grants']);

    // Optimistically update
    queryClient.setQueryData(['saved-grants'], (old) => {
      return old.map(g => g.id === grantId ? { ...g, status: newStatus } : g);
    });

    return { previousGrants };
  },
  onError: (err, newStatus, context) => {
    // Rollback on error
    queryClient.setQueryData(['saved-grants'], context.previousGrants);
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries(['saved-grants']);
  }
});
```

### Server-side Caching

**Database Query Caching**:
- Connection pooling (PgBouncer)
- Prepared statements
- Materialized views for complex aggregations

**API Response Caching**:
- CDN caching for static assets
- Short-lived cache for grant search (5 minutes)
- Long-lived cache for grant catalog (1 hour)

## Error Handling & Retry Logic

### Client Retry Strategy

```typescript
const query = useQuery({
  queryKey: ['grants'],
  queryFn: fetchGrants,
  retry: 3,                    // Retry 3 times
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  staleTime: 5 * 60 * 1000,   // Consider fresh for 5 minutes
  cacheTime: 10 * 60 * 1000   // Keep in cache for 10 minutes
});
```

### API Error Handling

1. **Network Errors**: Retry with exponential backoff
2. **Auth Errors**: Redirect to login, attempt token refresh
3. **Rate Limit Errors**: Queue requests, retry after delay
4. **Server Errors**: Show user-friendly message, log to monitoring

### Database Transaction Management

```sql
-- Example transaction for saving grant with tasks
BEGIN;
  -- Insert grant
  INSERT INTO org_grants_saved (...) VALUES (...);

  -- Create tasks
  INSERT INTO grant_tasks (...) SELECT ...;

  -- Log activity
  INSERT INTO grant_activity_log (...) VALUES (...);
COMMIT;
```

## Performance Optimization

### Database Optimizations

1. **Indexes**: All foreign keys and frequently queried columns
2. **Partitioning**: Large tables partitioned by org_id
3. **Query Optimization**: EXPLAIN ANALYZE for slow queries
4. **Connection Pooling**: Max 100 connections per instance

### API Optimizations

1. **Request Batching**: Multiple queries in single request
2. **Response Compression**: Gzip compression enabled
3. **Pagination**: Limit result sets to 50 records
4. **Field Selection**: Only return requested fields

### Frontend Optimizations

1. **Code Splitting**: Route-based lazy loading
2. **Component Memoization**: React.memo for expensive components
3. **Virtual Scrolling**: Large lists rendered virtually
4. **Image Optimization**: Lazy loading, responsive images

## Related Documentation

- [System Overview](./system-overview.md)
- [Authentication](./authentication.md)
- [Permissions (RBAC)](./permissions.md)
- [Database Schema](../database/schema.md)
