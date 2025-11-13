# Fix for Supabase Migration Push Issue

## Problem Identified

The error "Remote migration versions not found in local migrations directory" occurs because:

1. **Deleted Migration Files**: Several migration files with version `20250223` were applied to the remote database but have since been deleted/renamed locally:
   - `20250223_fix_signup_rls_policy.sql` (deleted due to security vulnerability)
   - `20250223_fix_signup_rls_policy_secure.sql` (deleted, replaced)
   - `20250223_fix_handle_new_user_rls.sql` (renamed to `20250224_fix_signup_rls.sql`)

2. **Migration History Mismatch**: The remote database's `supabase_migrations.schema_migrations` table contains references to these deleted/renamed migrations, but the local `supabase/migrations/` directory no longer has files with those exact names.

## Solution

### Step 1: Check Remote Migration Status

First, see what migrations the remote database thinks are applied:

```bash
npx supabase migration list
```

This will show you which migrations exist remotely but not locally (these will likely include the 20250223 versions).

### Step 2: Repair the Migration History

For each migration that exists remotely but not locally, you need to mark it as "reverted" in the remote database. Based on the git history, you should run:

```bash
# Remove the old 20250223 migrations from remote history
npx supabase migration repair 20250223_fix_signup_rls_policy --status reverted
npx supabase migration repair 20250223_fix_signup_rls_policy_secure --status reverted
npx supabase migration repair 20250223_fix_handle_new_user_rls --status reverted
```

**Note**: The `migration repair` command removes the migration record from the `supabase_migrations.schema_migrations` table but does NOT undo any schema changes. Since these migrations were replaced with better versions (20250224), this is safe.

### Step 3: Check for Other Missing Migrations

If `migration list` shows any other migrations that exist remotely but not locally (like the deleted `20250108_create_org_grants_saved.sql`), repair those too:

```bash
# Example - adjust the exact filename as needed
npx supabase migration repair 20250108_create_org_grants_saved --status reverted
```

### Step 4: Push the Updated Migrations

Now you should be able to push your local migrations:

```bash
npx supabase db push --include-all
```

## Alternative Solution: Pull and Reconcile

If the repair approach doesn't work, you can pull the remote schema and reconcile:

```bash
# Pull the current remote schema into a new migration file
npx supabase db pull

# This creates a new migration file like supabase/migrations/<timestamp>_remote_schema.sql
# You can then review and integrate it with your local migrations
```

## Prevention

To avoid this issue in the future:

1. **Never delete migration files** that have been pushed to production/remote
2. If you need to undo a migration, create a new "down" migration that reverses the changes
3. Always check `supabase migration list` before and after making changes
4. Use version control carefully when dealing with migrations

## Technical Details

### What Happened:

1. Commits e7d0f4a, 2d91fa9, and 59310c9 created migration files with version 20250223
2. These migrations were likely pushed to the remote database
3. Commits 22ec69d and 946d458 deleted/renamed these files due to security fixes
4. The remote database still has records of 20250223 migrations
5. When trying to push, Supabase CLI detects the mismatch and errors

### Why This Works:

- `migration repair --status reverted` removes the entry from `supabase_migrations.schema_migrations`
- This tells Supabase "ignore this migration in the history"
- The actual schema changes remain (which is what we want, since 20250224 contains the correct fixed version)
- After repair, the migration history matches between local and remote

## Testing

After applying the fix:

1. Run `npx supabase migration list` - should show no conflicts
2. Run `npx supabase db push --include-all` - should succeed
3. Verify the database schema is correct
4. Test the application to ensure everything works

## Troubleshooting

### If you get "migration not found" errors:

The exact migration names might be slightly different. Run `npx supabase migration list` to see the exact names stored in the remote database, then use those exact names in the repair commands.

### If repair doesn't work:

You might need to connect directly to the database and manually delete rows from `supabase_migrations.schema_migrations`:

```sql
-- CAREFUL: Only do this if you know what you're doing
DELETE FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20250223_fix_signup_rls_policy',
  '20250223_fix_signup_rls_policy_secure',
  '20250223_fix_handle_new_user_rls'
);
```

### If you need help:

Check the Supabase CLI documentation:
- [Migration Repair](https://supabase.com/docs/reference/cli/supabase-migration-repair)
- [DB Push](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Troubleshooting](https://supabase.com/docs/guides/deployment/branching/troubleshooting)
