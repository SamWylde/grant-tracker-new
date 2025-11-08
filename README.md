# Grant Tracker - Discover Federal Grants

A grant discovery and tracking platform that helps organizations find and manage federal grant opportunities from Grants.gov.

## Features

- **Search & Discover**: Search federal grants by keyword, category, agency, and status
- **Smart Filters**: Filter by funding category, agency, opportunity status, and due date
- **Save to Pipeline**: Save interesting opportunities to your organization's pipeline
- **Real-time Data**: Live data from Grants.gov Search2 API (no authentication required)
- **Responsive Design**: Built with Mantine UI for a modern, mobile-friendly experience

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **UI Library**: Mantine v8
- **Routing**: React Router v7
- **Data Fetching**: TanStack Query v5
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL with RLS)
- **Dates**: dayjs

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn 4.10+
- Supabase account and project
- Vercel account (for deployment)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd grant-tracker-new
```

2. Install dependencies:
```bash
yarn install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Then edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

For the API routes (serverless functions), also set:
```
SUPABASE_URL=your-project-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. Set up the database:

**IMPORTANT**: You must run this migration before the app will work!

Go to your Supabase project → SQL Editor, then copy and paste the contents of `supabase/migrations/20250108_create_org_grants_saved.sql` and execute it. This creates the `org_grants_saved` table with RLS policies.

To verify the table was created, run:
```sql
SELECT * FROM public.org_grants_saved LIMIT 1;
```

5. Start the development server:
```bash
yarn dev
```

Visit `http://localhost:5173` to see the app.

## Project Structure

```
grant-tracker-new/
├── api/                      # Vercel serverless functions
│   ├── grants/
│   │   └── search.ts        # Proxy to Grants.gov Search2 API
│   └── saved.ts             # CRUD for saved grants
├── src/
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client config
│   │   └── database.types.ts # Database TypeScript types
│   ├── pages/
│   │   ├── HomePage.tsx     # Marketing/landing page
│   │   └── DiscoverPage.tsx # Grant search & discovery
│   ├── types/
│   │   └── grants.ts        # Grant-related TypeScript types
│   ├── App.tsx              # App router and providers
│   ├── main.tsx             # React entry point
│   └── theme.ts             # Mantine theme config
├── supabase/
│   └── migrations/
│       └── 20250108_create_org_grants_saved.sql
├── vercel.json              # Vercel deployment config
└── package.json
```

## API Routes

### `POST /api/grants/search`

Proxies requests to Grants.gov Search2 API with validation and normalization.

**Request body:**
```json
{
  "keyword": "climate",
  "fundingCategories": "EN",
  "agencies": "EPA",
  "oppStatuses": "posted|forecasted",
  "rows": 25,
  "startRecordNum": 0
}
```

**Response:**
```json
{
  "grants": [...],
  "totalCount": 1234,
  "startRecord": 0,
  "pageSize": 25
}
```

### `GET /api/saved?org_id={uuid}`

Get all saved grants for an organization.

### `POST /api/saved`

Save a grant to the pipeline.

**Request body:**
```json
{
  "org_id": "uuid",
  "user_id": "uuid",
  "external_id": "grant-id",
  "title": "Grant Title",
  "agency": "Agency Name",
  "aln": "12.345",
  "open_date": "2025-01-01",
  "close_date": "2025-03-01"
}
```

### `DELETE /api/saved?id={uuid}`

Remove a saved grant from the pipeline.

## Database Schema

### `org_grants_saved`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| user_id | uuid | User who saved it |
| external_source | text | 'grants.gov' |
| external_id | text | Grants.gov opportunity ID |
| title | text | Grant title |
| agency | text | Agency name |
| aln | text | Assistance Listing Number (CFDA) |
| open_date | timestamptz | Open date |
| close_date | timestamptz | Close date |
| saved_at | timestamptz | When saved |
| created_at | timestamptz | Row creation time |

**Unique constraint**: (org_id, external_source, external_id)

**RLS Policies**: Users can view/insert/delete grants for their organization only.

## Deployment

### Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

The `/api` directory will be automatically deployed as serverless functions.

## Development Notes

### v1 Scope

This is a v1 implementation focused on:
- Basic search and filtering
- Save/unsave functionality
- Client-side sorting by close date
- No authentication (uses mock org/user IDs)

### Future Enhancements

- User authentication and real org context
- Grant detail drawer with full opportunity data
- Saved grants management page
- Email notifications for closing deadlines
- Team collaboration features
- Pipeline analytics

## API Reference

- [Grants.gov Search2 API](https://grants.gov/api/common/search2)
- [Grants.gov API Guide](https://grants.gov/api/api-guide)

## License

MIT
