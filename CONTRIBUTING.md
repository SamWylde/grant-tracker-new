# Contributing to GrantCue

Thank you for your interest in contributing to GrantCue! This guide will help you get started with development, understand our workflows, and submit high-quality contributions.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment](#development-environment)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Code Style Guide](#code-style-guide)
6. [Testing Requirements](#testing-requirements)
7. [Pull Request Process](#pull-request-process)
8. [Commit Message Conventions](#commit-message-conventions)
9. [Database Migrations](#database-migrations)
10. [API Development](#api-development)
11. [Common Tasks](#common-tasks)

## Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js**: v18.x or higher
- **Yarn**: v4.10.3 (package manager)
- **Git**: Latest version
- **Supabase Account**: For database and auth services
- **Vercel Account**: For deployment (optional for local development)

### Initial Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/SamWylde/grant-tracker-new.git
   cd grant-tracker-new
   ```

2. **Install dependencies**:
   ```bash
   yarn install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

   Fill in the required values:
   ```env
   # Client-side (Vite)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_OPEN_AI_API_KEY=your-openai-key  # Optional

   # Server-side (API routes)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   RESEND_API_KEY=your-resend-api-key
   CRON_SECRET=your-secure-random-string-min-32-chars
   OPEN_AI_API_KEY=your-openai-key
   ```

4. **Set up the database**:
   - Create a new Supabase project
   - Run migrations in order from `/supabase/migrations/`
   - Verify migrations succeeded

5. **Start the development server**:
   ```bash
   yarn dev
   ```

   The app will be available at `http://localhost:5173`

## Development Environment

### Recommended IDE Setup

**Visual Studio Code** with the following extensions:

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Language support
- **Tailwind CSS IntelliSense**: CSS utility class autocomplete
- **Database Client**: SQL query execution

### VSCode Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### Browser Setup

Install these browser extensions for debugging:

- **React Developer Tools**: Component inspection
- **Redux DevTools**: State debugging (if using Redux)
- **React Query DevTools**: Built-in, automatically enabled in dev mode

## Project Structure

```
grant-tracker-new/
├── api/                      # Vercel serverless functions
│   ├── grants/              # Grant-related endpoints
│   ├── oauth/               # OAuth integrations
│   ├── cron/                # Scheduled jobs
│   ├── admin/               # Admin endpoints
│   └── utils/               # Shared utilities
├── src/                     # React application
│   ├── components/          # Reusable UI components
│   ├── pages/               # Route components
│   ├── contexts/            # React Context providers
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities and services
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Helper functions
├── supabase/
│   └── migrations/          # Database migration files
├── docs/                    # Documentation
│   ├── architecture/        # Architecture docs
│   └── database/            # Database docs
├── public/                  # Static assets
└── scripts/                 # Utility scripts
```

### Key Directories

- **`/api`**: Serverless API functions. Each file exports a default function handler.
- **`/src/pages`**: React components mapped to routes.
- **`/src/components`**: Reusable UI components. Prefer composition over props.
- **`/src/lib`**: Business logic, API clients, utilities.
- **`/supabase/migrations`**: SQL migration files. Never modify existing migrations.

## Development Workflow

### Branch Strategy

We follow a **feature branch workflow**:

1. **Main branch**: `main` (or `master`) - Production-ready code
2. **Feature branches**: `feature/description` or `fix/description`
3. **Release branches**: `release/vX.Y.Z` (if applicable)

### Creating a New Feature

1. **Create a feature branch**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/add-grant-export
   ```

2. **Make your changes**:
   - Write code following our style guide
   - Add tests for new functionality
   - Update documentation as needed

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add CSV export for grants"
   ```

4. **Push to remote**:
   ```bash
   git push origin feature/add-grant-export
   ```

5. **Open a Pull Request**:
   - Go to GitHub and open a PR
   - Fill out the PR template
   - Request reviews from team members

### Bug Fixes

For bug fixes, use `fix/` prefix:

```bash
git checkout -b fix/grant-deadline-timezone
```

### Hotfixes

For critical production issues:

```bash
git checkout -b hotfix/security-patch
```

Merge directly to main after review and testing.

## Code Style Guide

### TypeScript

**Use TypeScript for all new code**. Avoid `any` types.

**Good**:
```typescript
interface Grant {
  id: string;
  title: string;
  closeDate: Date | null;
}

function saveGrant(grant: Grant): Promise<void> {
  // Implementation
}
```

**Bad**:
```typescript
function saveGrant(grant: any): any {
  // Implementation
}
```

### Naming Conventions

- **Components**: PascalCase (`GrantCard`, `UserMenu`)
- **Functions**: camelCase (`saveGrant`, `formatDate`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`, `API_BASE_URL`)
- **Types/Interfaces**: PascalCase (`Grant`, `UserProfile`)
- **Files**:
  - Components: PascalCase (`GrantCard.tsx`)
  - Utilities: camelCase (`dateUtils.ts`)
  - API routes: kebab-case (`saved-status.ts`)

### Component Structure

Organize components with this structure:

```typescript
// 1. Imports
import { useState } from 'react';
import { Card, Button } from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';

// 2. Types/Interfaces
interface GrantCardProps {
  grant: Grant;
  onEdit: (id: string) => void;
}

// 3. Component
export function GrantCard({ grant, onEdit }: GrantCardProps) {
  // 4. Hooks
  const [isHovered, setIsHovered] = useState(false);

  // 5. Event handlers
  const handleEdit = () => {
    onEdit(grant.id);
  };

  // 6. Render
  return (
    <Card
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <h3>{grant.title}</h3>
      {isHovered && (
        <Button onClick={handleEdit} leftSection={<IconEdit />}>
          Edit
        </Button>
      )}
    </Card>
  );
}
```

### React Best Practices

1. **Use functional components** with hooks
2. **Destructure props** in function parameters
3. **Avoid prop drilling**: Use Context or React Query
4. **Memoize expensive operations**: Use `useMemo` and `useCallback`
5. **Keep components small**: Extract logic to custom hooks
6. **Use TypeScript**: Define prop interfaces

**Good**:
```typescript
export function GrantList({ orgId }: { orgId: string }) {
  const { data: grants, isLoading } = useQuery({
    queryKey: ['grants', orgId],
    queryFn: () => fetchGrants(orgId)
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      {grants?.map(grant => (
        <GrantCard key={grant.id} grant={grant} />
      ))}
    </div>
  );
}
```

### API Endpoint Structure

Follow this template for API endpoints:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUserAuth, verifyOrgMembership, sendAuthError } from './utils/auth-middleware';
import { rateLimitStandard, handleRateLimit } from './utils/ratelimit';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Apply rate limiting
  const rateLimitResult = await rateLimitStandard(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

  // 2. Check HTTP method
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Verify environment
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 4. Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 5. Verify authentication
  const authResult = await verifyUserAuth(req, supabase);
  if (!authResult.success) {
    return sendAuthError(res, authResult);
  }
  const user = authResult.user!;

  try {
    // 6. Get and validate parameters
    const { org_id } = req.method === 'GET' ? req.query : req.body;

    if (!org_id || typeof org_id !== 'string') {
      return res.status(400).json({ error: 'org_id is required' });
    }

    // 7. Verify organization membership
    const membershipResult = await verifyOrgMembership(supabase, user.id, org_id);
    if (!membershipResult.success) {
      return sendAuthError(res, membershipResult);
    }

    // 8. Business logic
    // ... your implementation

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in API endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

### CSS/Styling

We use **Mantine** for UI components. Prefer Mantine components over custom CSS.

**Good**:
```typescript
<Button variant="filled" color="blue" leftSection={<IconPlus />}>
  Add Grant
</Button>
```

**Avoid**:
```typescript
<button className="custom-blue-button">
  Add Grant
</button>
```

For custom styles, use Mantine's `sx` prop or CSS modules.

## Testing Requirements

### Unit Tests

Write unit tests for:
- Utility functions
- Custom hooks
- Business logic

**Example**:
```typescript
// dateUtils.test.ts
import { formatDeadline } from './dateUtils';

describe('formatDeadline', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-12-31');
    expect(formatDeadline(date)).toBe('December 31, 2024');
  });

  it('handles null dates', () => {
    expect(formatDeadline(null)).toBe('No deadline');
  });
});
```

### Integration Tests

Test complete user flows:
- Grant saving workflow
- Task creation
- Document upload

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] Feature works in Chrome, Firefox, Safari
- [ ] Mobile responsive design
- [ ] Loading states display correctly
- [ ] Error messages are user-friendly
- [ ] Authentication/authorization works
- [ ] No console errors or warnings

## Pull Request Process

### Before Opening a PR

1. **Run type checking**:
   ```bash
   yarn typecheck
   ```

2. **Run linter**:
   ```bash
   yarn lint
   ```

3. **Test locally**:
   - Test all affected features
   - Check for console errors
   - Verify mobile responsiveness

4. **Update documentation**:
   - Update README if needed
   - Add/update code comments
   - Update relevant docs in `/docs`

### PR Template

When opening a PR, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] Checked mobile responsiveness

## Screenshots (if applicable)
[Add screenshots]

## Checklist
- [ ] Code follows style guide
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings
```

### Review Process

1. **Request reviews** from relevant team members
2. **Address feedback** promptly and professionally
3. **Update PR** based on feedback
4. **Resolve conflicts** with main branch
5. **Wait for approval** (minimum 1 approval required)

### Merging

- **Squash and merge** for feature branches
- **Rebase and merge** for clean history (optional)
- **Delete branch** after merging

## Commit Message Conventions

We follow **Conventional Commits** specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring (no functional changes)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (dependencies, build, etc.)

### Examples

**Feature**:
```
feat(grants): add CSV export functionality

Adds ability to export grant list to CSV format.
Includes organization name, grant details, and deadlines.
```

**Bug fix**:
```
fix(auth): resolve token refresh loop

Fixed infinite loop when refresh token expires.
Now properly redirects to login page.

Closes #123
```

**Breaking change**:
```
feat(api)!: change grant status field to enum

BREAKING CHANGE: Grant status is now an enum instead of string.
Migration required for existing grants.
```

### Commit Best Practices

1. **Use imperative mood**: "add feature" not "added feature"
2. **Keep subject under 50 characters**
3. **Separate subject from body** with blank line
4. **Wrap body at 72 characters**
5. **Reference issues** in footer (`Closes #123`)

## Database Migrations

### Creating a Migration

1. **Name the migration**:
   ```
   YYYYMMDD_description.sql
   ```
   Example: `20250320_add_grant_categories.sql`

2. **Write idempotent SQL**:
   ```sql
   -- Add column (idempotent)
   ALTER TABLE org_grants_saved
   ADD COLUMN IF NOT EXISTS category TEXT;

   -- Create index (idempotent)
   CREATE INDEX IF NOT EXISTS idx_grants_category
   ON org_grants_saved(category);
   ```

3. **Test the migration**:
   - Run on local database
   - Verify no errors
   - Check data integrity

4. **Never modify existing migrations**:
   - Create a new migration to fix issues
   - Previous migrations must remain unchanged

### Migration Best Practices

- **Always use `IF NOT EXISTS`** for idempotency
- **Add indexes** for new foreign keys
- **Update RLS policies** if needed
- **Include rollback instructions** in comments
- **Test on staging** before production

### Example Migration

```sql
-- =====================================================
-- Add Grant Categories Feature
-- Created: 2025-03-20
-- =====================================================

-- Add category field to grants
ALTER TABLE org_grants_saved
ADD COLUMN IF NOT EXISTS category TEXT;

-- Create categories lookup table
CREATE TABLE IF NOT EXISTS grant_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories
INSERT INTO grant_categories (name, description) VALUES
  ('Infrastructure', 'Infrastructure and construction grants'),
  ('Education', 'Education and training grants'),
  ('Healthcare', 'Healthcare and public health grants')
ON CONFLICT (name) DO NOTHING;

-- Add foreign key
ALTER TABLE org_grants_saved
ADD CONSTRAINT fk_category
FOREIGN KEY (category) REFERENCES grant_categories(name);

-- Add index
CREATE INDEX IF NOT EXISTS idx_grants_category
ON org_grants_saved(category);

-- Update RLS policy
DROP POLICY IF EXISTS "Users can view org grants" ON org_grants_saved;
CREATE POLICY "Users can view org grants"
  ON org_grants_saved
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Rollback instructions:
-- DROP INDEX idx_grants_category;
-- ALTER TABLE org_grants_saved DROP CONSTRAINT fk_category;
-- ALTER TABLE org_grants_saved DROP COLUMN category;
-- DROP TABLE grant_categories;
```

## API Development

### Adding a New API Endpoint

1. **Create file** in `/api` directory:
   ```typescript
   // api/example.ts
   export default async function handler(req, res) {
     // Implementation
   }
   ```

2. **Add authentication**:
   ```typescript
   const authResult = await verifyUserAuth(req, supabase);
   if (!authResult.success) {
     return sendAuthError(res, authResult);
   }
   ```

3. **Add rate limiting**:
   ```typescript
   const rateLimitResult = await rateLimitStandard(req);
   if (handleRateLimit(res, rateLimitResult)) {
     return;
   }
   ```

4. **Validate input**:
   ```typescript
   const schema = z.object({
     org_id: z.string().uuid(),
     title: z.string().min(1)
   });

   const result = schema.safeParse(req.body);
   if (!result.success) {
     return res.status(400).json({ error: result.error });
   }
   ```

5. **Test endpoint**:
   - Use Postman or curl
   - Test authentication
   - Test error cases
   - Test rate limiting

### API Response Format

**Success**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Error**:
```json
{
  "error": "Error message",
  "statusCode": 400
}
```

## Common Tasks

### Adding a New Page

1. Create component in `/src/pages`:
   ```typescript
   // src/pages/NewPage.tsx
   export function NewPage() {
     return <div>New Page</div>;
   }
   ```

2. Add route in `main.tsx`:
   ```typescript
   <Route path="/new-page" element={<NewPage />} />
   ```

3. Add navigation link if needed:
   ```typescript
   <NavLink to="/new-page">New Page</NavLink>
   ```

### Adding a New Component

1. Create file in `/src/components`:
   ```typescript
   // src/components/NewComponent.tsx
   interface NewComponentProps {
     title: string;
   }

   export function NewComponent({ title }: NewComponentProps) {
     return <div>{title}</div>;
   }
   ```

2. Export from index if needed:
   ```typescript
   // src/components/index.ts
   export { NewComponent } from './NewComponent';
   ```

### Adding a Database Table

1. Create migration file:
   ```sql
   -- supabase/migrations/20250320_add_new_table.sql
   CREATE TABLE new_table (
     id UUID PRIMARY KEY,
     -- columns
   );
   ```

2. Add RLS policies:
   ```sql
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "policy_name"
     ON new_table
     FOR SELECT
     USING ( ... );
   ```

3. Update TypeScript types in `/src/lib/database.types.ts`

### Debugging Tips

**Frontend Debugging**:
- Use React DevTools to inspect component state
- Use TanStack Query DevTools to inspect cache
- Check browser console for errors
- Use `console.log` or debugger statements

**Backend Debugging**:
- Check Vercel function logs
- Add console.log statements
- Use Postman to test API endpoints
- Check Supabase logs for database errors

**Database Debugging**:
- Use Supabase SQL Editor to run queries
- Check RLS policies with `EXPLAIN`
- Verify indexes with `EXPLAIN ANALYZE`

## Getting Help

- **Documentation**: Check `/docs` directory
- **Issues**: Search existing GitHub issues
- **Questions**: Open a discussion on GitHub
- **Chat**: Join our Slack/Discord (if available)

## Code of Conduct

- Be respectful and professional
- Provide constructive feedback
- Help others learn and grow
- Focus on what is best for the project

Thank you for contributing to GrantCue! 🎉
