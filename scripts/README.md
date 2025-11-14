# Grant Catalog Maintenance Scripts

## Fix Grant Titles and Descriptions

These scripts fetch real grant titles and descriptions from Grants.gov API and update your `grants_catalog` table.

### Problem

When grants are initially synced to the catalog, they may have placeholder titles like "Grant 12345" or "Untitled Grant", and some may be missing descriptions. This happens because the initial sync uses the Grants.gov search API which doesn't always include full details.

### Solution

These scripts fetch complete grant details from the Grants.gov details API (`fetchOpportunity`) and update your catalog.

## Usage

### 1. Test Mode (First Time)

Test on just 5 grants first to make sure everything works:

```bash
npm run fix-grants:test
```

This will:
- Process only the first 5 grants
- Show detailed output for each grant
- Update the database if successful

### 2. Full Run

Once the test looks good, run the full script:

```bash
npm run fix-grants
```

This will:
- Process ALL grants with bad titles or missing descriptions
- Work in batches of 5 with 2-second delays to respect rate limits
- Show progress for each batch
- Display final statistics

### What Gets Fixed

The script fixes grants that have:
- ❌ Placeholder titles matching `Grant [number]` pattern
- ❌ Title of "Untitled Grant"
- ❌ NULL or empty title
- ❌ Missing description
- ❌ Missing agency name

### Expected Output

```
🔍 Finding grants with bad titles or missing descriptions...

📊 Stats:
   Total grants in catalog: 220
   Grants needing fixes: 220

🚀 Starting to fix 220 grants...

📦 Batch 1/44 (Grants 1-5)
────────────────────────────────────────────────────────

  🔄 Processing grant 123456
     Current title: "Grant 123456"
     Has description: ❌ No
     ✨ New title: "Innovative Education Program FY2025"
     ✨ Added description (245 chars)
     ✅ Updated successfully

  ...

═══════════════════════════════════════════════════════════
📊 FINAL RESULTS
═══════════════════════════════════════════════════════════
✅ Successfully fixed: 215 grants
❌ Failed: 3 grants
⚠️  Skipped: 2 grants
═══════════════════════════════════════════════════════════
```

### Rate Limiting

The script processes 5 grants at a time with a 2-second delay between batches to avoid overwhelming the Grants.gov API. For 220 grants, this takes approximately **3-4 minutes**.

### Troubleshooting

**"Missing required environment variables"**
- Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in your environment
- These are automatically set when deployed to Vercel
- For local development, add them to `.env.local`

**"API returned 404 for grant XXXXX"**
- Some grants may have been removed from Grants.gov
- These will be skipped automatically

**Script hangs or times out**
- The Grants.gov API may be slow or down
- Stop the script (Ctrl+C) and try again later
- Progress is saved incrementally, so you can resume

### Manual Verification

After running the script, check your discover page:
1. Visit https://www.grantcue.com/discover
2. Verify grants now show proper titles
3. Click "Details" on a few grants to verify descriptions are present

Or run this SQL query:

```sql
SELECT
  COUNT(*) as total_grants,
  SUM(CASE WHEN title ~ '^Grant [0-9]+$' OR title = 'Untitled Grant' THEN 1 ELSE 0 END) as bad_titles,
  SUM(CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END) as no_description
FROM grants_catalog
WHERE source_key = 'grants_gov' AND is_active = true;
```

Expected result after running the script:
```
total_grants: 220
bad_titles: 0
no_description: 0
```
