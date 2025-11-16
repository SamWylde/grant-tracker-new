#!/bin/bash

# Fix Supabase Migration History
# This script repairs the migration history mismatch between local and remote

set -e  # Exit on error

echo "====================================="
echo "Supabase Migration History Fix"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Checking current migration status...${NC}"
echo ""
npx --yes supabase@latest migration list || {
    echo -e "${RED}Failed to list migrations. Make sure your project is linked.${NC}"
    echo "Run: npx supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
}

echo ""
echo -e "${YELLOW}Step 2: Repairing migration history...${NC}"
echo ""

# List of migrations that were deleted/renamed locally but may exist remotely
DELETED_MIGRATIONS=(
    "20250223_fix_signup_rls_policy"
    "20250223_fix_signup_rls_policy_secure"
    "20250223_fix_handle_new_user_rls"
    "20250108_create_org_grants_saved"
)

for migration in "${DELETED_MIGRATIONS[@]}"; do
    echo -e "${YELLOW}Attempting to repair: $migration${NC}"
    npx --yes supabase@latest migration repair "$migration" --status reverted 2>&1 || {
        echo -e "${RED}Warning: Could not repair $migration (it may not exist remotely)${NC}"
    }
    echo ""
done

echo -e "${GREEN}Step 3: Checking migration status after repair...${NC}"
echo ""
npx --yes supabase@latest migration list

echo ""
echo -e "${GREEN}Step 4: Attempting to push migrations...${NC}"
echo ""
npx --yes supabase@latest db push --include-all

echo ""
echo -e "${GREEN}====================================="
echo "Migration fix completed successfully!"
echo "=====================================${NC}"
echo ""
echo "Next steps:"
echo "1. Verify your database schema is correct"
echo "2. Test your application"
echo "3. Commit these changes if everything works"
