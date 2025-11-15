#!/bin/bash

# Verify Local Migration Files
# This script checks that local migrations are in the expected state

echo "====================================="
echo "Local Migration Verification"
echo "====================================="
echo ""

MIGRATIONS_DIR="/home/user/grant-tracker-new/supabase/migrations"

# Count total migrations
TOTAL=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
echo "Total migration files: $TOTAL"
echo "Expected: 44"

if [ "$TOTAL" -eq 44 ]; then
    echo "✅ Correct number of migrations"
else
    echo "⚠️  Warning: Expected 44 migrations, found $TOTAL"
fi

echo ""
echo "-----------------------------------"
echo "Checking for problematic migrations..."
echo "-----------------------------------"
echo ""

# Check for 20250223 files (should NOT exist)
if ls "$MIGRATIONS_DIR"/20250223*.sql >/dev/null 2>&1; then
    echo "❌ PROBLEM: Found 20250223 migration files:"
    ls -1 "$MIGRATIONS_DIR"/20250223*.sql
    echo ""
    echo "These files should NOT exist locally!"
    echo "They were deleted/renamed due to security fixes."
else
    echo "✅ No 20250223 migrations found (correct)"
fi

echo ""

# Check for 20250224 file (SHOULD exist)
if ls "$MIGRATIONS_DIR"/20250224*.sql >/dev/null 2>&1; then
    echo "✅ Found 20250224 migration (correct):"
    ls -1 "$MIGRATIONS_DIR"/20250224*.sql
else
    echo "❌ PROBLEM: 20250224_fix_signup_rls.sql not found!"
    echo "This file should exist as the replacement for 20250223 migrations."
fi

echo ""
echo "-----------------------------------"
echo "Local migrations status:"
echo "-----------------------------------"
echo ""

if [ "$TOTAL" -eq 44 ] && ! ls "$MIGRATIONS_DIR"/20250223*.sql >/dev/null 2>&1 && ls "$MIGRATIONS_DIR"/20250224*.sql >/dev/null 2>&1; then
    echo "✅ LOCAL MIGRATIONS ARE CORRECT"
    echo ""
    echo "The issue is with the REMOTE database history."
    echo "The remote database has records of 20250223 migrations"
    echo "that no longer exist in this local directory."
    echo ""
    echo "Next steps:"
    echo "1. Run: ./fix-migrations.sh"
    echo "2. Or follow instructions in QUICK_FIX.md"
else
    echo "⚠️  LOCAL MIGRATIONS HAVE ISSUES"
    echo ""
    echo "Please review the problems above before proceeding."
fi

echo ""
echo "====================================="
