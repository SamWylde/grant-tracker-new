# System Architecture Overview

## Introduction

GrantCue is a comprehensive grant discovery and workflow management platform designed to help organizations find, track, and manage federal grant opportunities. The system is built with a modern, scalable architecture leveraging serverless infrastructure and cloud services.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  React 19 + TypeScript + Vite                                   │
│  - Mantine UI Components                                         │
│  - React Router v7 (Client-side routing)                        │
│  - TanStack Query v5 (Data fetching & caching)                  │
│  - React Context (Global state management)                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTPS / WebSocket
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                     API LAYER (Vercel)                          │
├─────────────────────────────────────────────────────────────────┤
│  Serverless Functions (Node.js/TypeScript)                      │
│  - /api/grants/* - Grant search, details, management            │
│  - /api/saved/* - Saved grants CRUD                             │
│  - /api/tasks/* - Task management                               │
│  - /api/auth/* - Authentication utilities                       │
│  - /api/oauth/* - Third-party OAuth flows                       │
│  - /api/cron/* - Scheduled jobs                                 │
│  - /api/admin/* - Administrative operations                     │
└──────┬──────────────┬──────────────┬───────────────────────────┘
       │              │              │
       │              │              │
       ▼              ▼              ▼
┌─────────────┐ ┌──────────┐ ┌────────────────┐
│  Supabase   │ │  OpenAI  │ │  External APIs │
│  (Backend)  │ │   GPT    │ │  (Grants.gov)  │
└─────────────┘ └──────────┘ └────────────────┘
       │
       ├─ PostgreSQL Database (with RLS)
       ├─ Authentication (JWT)
       ├─ Storage (Documents)
       └─ Realtime (Subscriptions)
```

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.1.1 | UI framework |
| TypeScript | 5.9.2 | Type safety |
| Vite | 7.1.5 | Build tool & dev server |
| Mantine | 8.3.7 | Component library |
| React Router | 7.9.5 | Client-side routing |
| TanStack Query | 5.90.7 | Server state management |
| @dnd-kit | 8.0.0 | Drag & drop functionality |
| dayjs | 1.11.19 | Date manipulation |

### Backend & Infrastructure

| Technology | Purpose |
|------------|---------|
| Vercel | Hosting, serverless functions, edge network |
| Supabase | PostgreSQL database, authentication, storage |
| PostgreSQL | Primary data store with Row Level Security |
| Node.js | Runtime for API functions |

### External Services

| Service | Purpose |
|---------|---------|
| OpenAI GPT-4o-mini | AI features (summaries, tagging, recommendations) |
| Resend | Email delivery |
| Grants.gov API | Federal grant data source |
| Google Calendar API | Calendar integration |
| Slack API | Slack notifications |
| Microsoft Teams API | Teams notifications |
| Upstash Redis | Rate limiting |

## Core Components

### 1. Client Application

**Location**: `/src`

The React-based single-page application that provides the user interface.

**Key Features**:
- Server-side rendering support via Vite
- Code splitting and lazy loading
- Optimistic UI updates
- Real-time data synchronization
- Responsive design (mobile, tablet, desktop)

**Main Directories**:
- `/src/pages` - Route components
- `/src/components` - Reusable UI components
- `/src/contexts` - React Context providers (Auth, Organization)
- `/src/hooks` - Custom React hooks
- `/src/lib` - Utilities and services
- `/src/types` - TypeScript type definitions
- `/src/utils` - Helper functions

### 2. API Layer

**Location**: `/api`

Serverless functions deployed on Vercel's edge network.

**Key Features**:
- Auto-scaling based on demand
- Global edge distribution
- Zero cold starts (with warming)
- Built-in HTTPS and CDN

**Main Directories**:
- `/api/grants` - Grant discovery and management
- `/api/oauth` - Third-party OAuth integrations
- `/api/cron` - Scheduled jobs (sync, alerts, reports)
- `/api/admin` - Platform administration
- `/api/utils` - Shared utilities (auth, rate limiting)

### 3. Database Layer

**Technology**: Supabase (PostgreSQL 15+)

**Key Features**:
- Row Level Security (RLS) for multi-tenancy
- Real-time subscriptions via WebSockets
- Automatic backups
- Point-in-time recovery
- Full-text search capabilities

**Schema Organization**:
- **Core Tables**: organizations, user_profiles, org_members
- **Grant Management**: org_grants_saved, grant_tasks, grant_activity_log
- **Discovery**: grants_catalog, grant_sources, sync_jobs
- **AI Features**: grant_ai_summaries, grant_tags, grant_recommendations
- **Post-Award**: grant_budgets, budget_line_items, grant_disbursements
- **Collaboration**: grant_comments, mentions
- **Integrations**: integrations, webhooks, webhook_deliveries
- **RBAC**: permissions, roles, role_permissions, user_role_assignments

### 4. Authentication & Authorization

**Primary Auth**: Supabase Auth (JWT-based)

**Auth Methods**:
- Email/Password
- Magic Links
- OAuth Providers (Google, GitHub, etc.)
- Two-Factor Authentication (2FA via TOTP)

**Authorization**:
- Row Level Security (RLS) policies in PostgreSQL
- Advanced RBAC system with granular permissions
- Organization-scoped access control
- Platform admin privileges

### 5. Storage Layer

**Document Storage**: Supabase Storage (S3-compatible)

**Features**:
- Secure file uploads
- Access control via RLS
- CDN delivery
- Storage quotas per organization plan
- Supported file types: PDF, DOC, DOCX, XLS, XLSX, images

### 6. Integrations Layer

**OAuth Integrations**:
- **Google Calendar**: Sync grant deadlines to calendar
- **Slack**: Send notifications to Slack channels
- **Microsoft Teams**: Send notifications to Teams channels

**Webhooks**:
- Custom webhook endpoints
- Event-driven notifications
- Delivery tracking and retry logic

## Data Flow Architecture

### Request Flow

1. **Client Request**
   - User interacts with UI
   - TanStack Query manages request state
   - Request sent to API endpoint

2. **API Processing**
   - Rate limiting check (Upstash Redis)
   - Authentication verification (JWT)
   - Authorization check (RLS policies)
   - Business logic execution
   - Database operations

3. **Database Operations**
   - Row Level Security enforcement
   - Query execution
   - Trigger execution (if applicable)
   - Return results

4. **Response**
   - API formats response
   - Client receives data
   - TanStack Query caches result
   - UI updates

### Real-time Data Flow

1. **Database Change**
   - INSERT/UPDATE/DELETE occurs
   - PostgreSQL triggers fire

2. **Supabase Realtime**
   - Change captured by Realtime engine
   - Filtered by RLS policies
   - Broadcast to subscribed clients

3. **Client Update**
   - Client receives real-time event
   - Local cache invalidated
   - UI auto-updates

## Deployment Architecture

### Production Environment

```
┌──────────────────────────────────────────────┐
│         Vercel Edge Network (CDN)            │
│  - Static assets                             │
│  - React application                         │
│  - API endpoints (serverless)                │
└───────────────┬──────────────────────────────┘
                │
                ├─► Supabase Cloud (us-east-1)
                │   - PostgreSQL Database
                │   - Auth Service
                │   - Storage Service
                │   - Realtime Service
                │
                ├─► OpenAI API
                │   - GPT-4o-mini endpoints
                │
                ├─► Resend API
                │   - Email delivery
                │
                ├─► Upstash Redis
                │   - Rate limiting
                │
                └─► External APIs
                    - Grants.gov Search API
                    - OAuth providers
```

### Scalability

**Horizontal Scaling**:
- Vercel auto-scales serverless functions
- Supabase connection pooling (PgBouncer)
- CDN edge caching

**Performance Optimizations**:
- Database indexes on all foreign keys
- Materialized views for complex queries
- Query result caching (TanStack Query)
- Lazy loading of components
- Image optimization

## Security Architecture

### Defense in Depth

1. **Network Layer**
   - HTTPS only (TLS 1.3)
   - Vercel DDoS protection
   - Rate limiting (per IP, per user)

2. **Authentication Layer**
   - JWT tokens with expiration
   - Secure password hashing (bcrypt)
   - 2FA support (TOTP)
   - Session management

3. **Authorization Layer**
   - Row Level Security (RLS)
   - RBAC with granular permissions
   - API middleware checks
   - Organization-scoped data access

4. **Application Layer**
   - Input validation (Zod)
   - SQL injection prevention (parameterized queries)
   - XSS prevention (DOMPurify)
   - CSRF protection

5. **Data Layer**
   - Encrypted at rest (AES-256)
   - Encrypted in transit (TLS)
   - Regular backups
   - Point-in-time recovery

## Monitoring & Observability

### Logging

- **Application Logs**: Vercel Function Logs
- **Database Logs**: Supabase Dashboard
- **Error Tracking**: Console logs (can be integrated with Sentry)

### Metrics

- **Performance**: Vercel Analytics
- **Database**: Supabase Dashboard (connections, queries)
- **API Usage**: Rate limit metrics
- **Business Metrics**: Custom analytics queries

### Alerts

- **Error Rates**: Function failures
- **Performance**: Slow queries (>1s)
- **Security**: Failed auth attempts, rate limit hits
- **Business**: System-wide issues

## Disaster Recovery

### Backup Strategy

- **Database**: Daily automated backups (retained 7 days)
- **Point-in-time Recovery**: Up to 7 days back
- **Storage**: Replicated across multiple availability zones

### Recovery Procedures

1. **Database Corruption**: Restore from backup
2. **Data Loss**: Point-in-time recovery
3. **Service Outage**: Automatic failover to standby
4. **Complete Disaster**: Restore from geographic backup

## Future Architecture Considerations

### Planned Enhancements

1. **Microservices Migration**
   - Separate grant sync service
   - Dedicated AI processing service
   - Independent notification service

2. **Caching Layer**
   - Redis cache for frequently accessed data
   - Edge caching for grant catalog

3. **Event-Driven Architecture**
   - Message queue (e.g., AWS SQS, Google Pub/Sub)
   - Event sourcing for audit trail
   - CQRS pattern for read/write separation

4. **Advanced Analytics**
   - Data warehouse (e.g., Snowflake, BigQuery)
   - Business intelligence dashboards
   - Machine learning pipeline

## Conclusion

GrantCue's architecture is designed for scalability, security, and maintainability. The serverless approach provides automatic scaling and reduced operational overhead, while Supabase offers a robust, secure database with built-in authentication and real-time capabilities.

The modular design allows for incremental improvements and feature additions without disrupting existing functionality. The comprehensive RBAC system ensures fine-grained access control, and the integration layer enables seamless connectivity with third-party services.

## Related Documentation

- [Data Flow](./data-flow.md)
- [Authentication](./authentication.md)
- [Permissions (RBAC)](./permissions.md)
- [Integrations](./integrations.md)
- [Database Schema](../database/schema.md)
