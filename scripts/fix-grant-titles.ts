/**
 * Fix Grant Titles and Descriptions
 *
 * This script fetches real titles and descriptions from Grants.gov API
 * for all grants in the catalog that have placeholder titles or missing descriptions.
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

interface CatalogGrant {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  agency: string | null;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGrantDetails(externalId: string) {
  try {
    const response = await fetch('https://api.grants.gov/v1/api/fetchOpportunity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: Number(externalId) }),
    });

    if (!response.ok) {
      console.warn(`  ⚠️  API returned ${response.status} for grant ${externalId}`);
      return null;
    }

    const data = await response.json();
    const title = data?.data?.title || null;
    const description = data?.data?.synopsis?.synopsisDesc || null;
    const agency = data?.data?.agencyName || null;

    return { title, description, agency };
  } catch (error) {
    console.error(`  ❌ Error fetching grant ${externalId}:`, error instanceof Error ? error.message : 'Unknown error');
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
      console.error(`  ❌ Failed to update catalog for grant ${externalId}:`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error updating grant ${externalId}:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function main() {
  console.log('🔍 Finding grants with bad titles or missing descriptions...\n');

  // Fetch all grants that need fixing
  const { data: grants, error } = await supabase
    .from('grants_catalog')
    .select('id, external_id, title, description, agency')
    .eq('source_key', 'grants_gov')
    .eq('is_active', true);

  if (error) {
    console.error('❌ Failed to fetch grants from catalog:', error.message);
    process.exit(1);
  }

  if (!grants || grants.length === 0) {
    console.log('✅ No grants found in catalog');
    process.exit(0);
  }

  // Filter grants that need fixing
  const grantsNeedingFix = grants.filter((g: CatalogGrant) => {
    const hasBadTitle = !g.title ||
                       /^Grant [0-9]+$/.test(g.title) ||
                       g.title === 'Untitled Grant';
    const hasNoDescription = !g.description;
    return hasBadTitle || hasNoDescription;
  });

  console.log(`📊 Stats:`);
  console.log(`   Total grants in catalog: ${grants.length}`);
  console.log(`   Grants needing fixes: ${grantsNeedingFix.length}`);
  console.log('');

  if (grantsNeedingFix.length === 0) {
    console.log('✅ All grants already have valid titles and descriptions!');
    process.exit(0);
  }

  console.log(`🚀 Starting to fix ${grantsNeedingFix.length} grants...\n`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  // Process in batches to avoid rate limiting
  const batchSize = 5; // Process 5 at a time
  const delayBetweenBatches = 2000; // 2 second delay between batches

  for (let i = 0; i < grantsNeedingFix.length; i += batchSize) {
    const batch = grantsNeedingFix.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(grantsNeedingFix.length / batchSize);

    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (Grants ${i + 1}-${Math.min(i + batchSize, grantsNeedingFix.length)})`);
    console.log('─'.repeat(60));

    await Promise.all(
      batch.map(async (grant: CatalogGrant) => {
        const hasBadTitle = !grant.title ||
                           /^Grant [0-9]+$/.test(grant.title) ||
                           grant.title === 'Untitled Grant';
        const hasNoDescription = !grant.description;

        console.log(`\n  🔄 Processing grant ${grant.external_id}`);
        console.log(`     Current title: "${grant.title}"`);
        console.log(`     Has description: ${hasNoDescription ? '❌ No' : '✅ Yes'}`);

        const details = await fetchGrantDetails(grant.external_id);

        if (!details) {
          console.log(`     ⚠️  Could not fetch details - skipping`);
          skippedCount++;
          return;
        }

        const updates: any = {};
        let needsUpdate = false;

        if (hasBadTitle && details.title) {
          updates.title = details.title;
          needsUpdate = true;
          console.log(`     ✨ New title: "${details.title}"`);
        }

        if (hasNoDescription && details.description) {
          updates.description = details.description;
          needsUpdate = true;
          console.log(`     ✨ Added description (${details.description.length} chars)`);
        }

        if (!grant.agency && details.agency) {
          updates.agency = details.agency;
          needsUpdate = true;
          console.log(`     ✨ Added agency: ${details.agency}`);
        }

        if (needsUpdate) {
          const success = await updateGrantInCatalog(grant.id, grant.external_id, updates);
          if (success) {
            console.log(`     ✅ Updated successfully`);
            successCount++;
          } else {
            console.log(`     ❌ Update failed`);
            failCount++;
          }
        } else {
          console.log(`     ℹ️  No updates needed`);
          skippedCount++;
        }
      })
    );

    // Delay between batches to respect rate limits
    if (i + batchSize < grantsNeedingFix.length) {
      console.log(`\n⏳ Waiting ${delayBetweenBatches / 1000}s before next batch...`);
      await sleep(delayBetweenBatches);
    }
  }

  console.log('\n');
  console.log('═'.repeat(60));
  console.log('📊 FINAL RESULTS');
  console.log('═'.repeat(60));
  console.log(`✅ Successfully fixed: ${successCount} grants`);
  console.log(`❌ Failed: ${failCount} grants`);
  console.log(`⚠️  Skipped: ${skippedCount} grants`);
  console.log('═'.repeat(60));

  if (successCount > 0) {
    console.log('\n🎉 Grant titles and descriptions have been updated!');
    console.log('   Visit your discover page to see the changes.');
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
