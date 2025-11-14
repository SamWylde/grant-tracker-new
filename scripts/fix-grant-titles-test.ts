/**
 * TEST VERSION - Fix Grant Titles and Descriptions
 *
 * This script tests fixing the first 5 grants only
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('  - SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_LIMIT = 5; // Only process 5 grants for testing

interface CatalogGrant {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  agency: string | null;
}

async function fetchGrantDetails(externalId: string) {
  try {
    console.log(`  📡 Fetching from Grants.gov API...`);
    const response = await fetch('https://api.grants.gov/v1/api/fetchOpportunity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: Number(externalId) }),
    });

    if (!response.ok) {
      console.warn(`  ⚠️  API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    const title = data?.data?.title || null;
    const description = data?.data?.synopsis?.synopsisDesc || null;
    const agency = data?.data?.agencyName || null;

    return { title, description, agency };
  } catch (error) {
    console.error(`  ❌ Error:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

async function updateGrantInCatalog(catalogId: string, externalId: string, updates: any) {
  try {
    const updateData: any = {
      last_synced_at: new Date().toISOString(),
    };

    if (updates.title) updateData.title = updates.title;
    if (updates.description) updateData.description = updates.description;
    if (updates.agency) updateData.agency = updates.agency;

    const { error } = await supabase
      .from('grants_catalog')
      .update(updateData)
      .eq('id', catalogId);

    if (error) {
      console.error(`  ❌ DB update failed:`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function main() {
  console.log('🧪 TEST MODE - Will only process first 5 grants\n');
  console.log('🔍 Finding grants with bad titles or missing descriptions...\n');

  // Fetch only first few grants for testing
  const { data: grants, error } = await supabase
    .from('grants_catalog')
    .select('id, external_id, title, description, agency')
    .eq('source_key', 'grants_gov')
    .eq('is_active', true)
    .limit(TEST_LIMIT);

  if (error) {
    console.error('❌ Failed to fetch grants:', error.message);
    process.exit(1);
  }

  if (!grants || grants.length === 0) {
    console.log('✅ No grants found');
    process.exit(0);
  }

  console.log(`📊 Found ${grants.length} grants to test\n`);

  for (const grant of grants) {
    const hasBadTitle = !grant.title ||
                       /^Grant [0-9]+$/.test(grant.title) ||
                       grant.title === 'Untitled Grant';
    const hasNoDescription = !grant.description;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔄 Grant ${grant.external_id}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`  📋 Current title: "${grant.title}"`);
    console.log(`  📝 Has description: ${hasNoDescription ? '❌ No' : '✅ Yes'}`);
    console.log(`  🏛️  Agency: ${grant.agency || '❌ None'}`);

    const details = await fetchGrantDetails(grant.external_id);

    if (!details) {
      console.log(`  ⚠️  Could not fetch details - skipping`);
      continue;
    }

    const updates: any = {};
    let needsUpdate = false;

    if (hasBadTitle && details.title) {
      updates.title = details.title;
      needsUpdate = true;
      console.log(`  ✨ New title: "${details.title}"`);
    }

    if (hasNoDescription && details.description) {
      updates.description = details.description;
      needsUpdate = true;
      console.log(`  ✨ Description: "${details.description.substring(0, 100)}..."`);
    }

    if (!grant.agency && details.agency) {
      updates.agency = details.agency;
      needsUpdate = true;
      console.log(`  ✨ Agency: ${details.agency}`);
    }

    if (needsUpdate) {
      console.log(`  💾 Updating database...`);
      const success = await updateGrantInCatalog(grant.id, grant.external_id, updates);
      if (success) {
        console.log(`  ✅ UPDATED SUCCESSFULLY`);
      } else {
        console.log(`  ❌ UPDATE FAILED`);
      }
    } else {
      console.log(`  ℹ️  No updates needed`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('🎉 Test complete! Check the results above.');
  console.log('   If everything looks good, run the full script with:');
  console.log('   npm run fix-grants');
  console.log(`${'='.repeat(70)}\n`);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
