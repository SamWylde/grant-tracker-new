# Quick Fix - Migration Issue

## The Problem
```
❌ supabase db push --include-all
Error: Remote migration versions not found in local migrations directory
```

## The Solution (2 minutes)

### Step 1: Link Project (if needed)
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

### Step 2: Run Fix Script
```bash
chmod +x fix-migrations.sh
./fix-migrations.sh
```

**OR** run these commands manually:

```bash
# Remove deleted migrations from remote history
npx supabase migration repair 20250223_fix_signup_rls_policy --status reverted
npx supabase migration repair 20250223_fix_signup_rls_policy_secure --status reverted
npx supabase migration repair 20250223_fix_handle_new_user_rls --status reverted

# Try push again
npx supabase db push --include-all
```

### Step 3: Verify
```bash
npx supabase migration list    # Should show no conflicts
npx supabase db push --include-all  # Should succeed ✅
```

---

## Why This Happened

Migration files `20250223_*` were deleted locally (security fixes) but still exist in remote database history.

## What The Fix Does

Removes records of deleted migrations from remote database so local and remote are in sync again.

## Safe?

✅ Yes - only removes history records, doesn't delete any actual database tables or functions.

---

**Need more details?** See `MIGRATION_FIX_REPORT.md`
