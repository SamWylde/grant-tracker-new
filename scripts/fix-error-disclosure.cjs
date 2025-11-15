#!/usr/bin/env node
/**
 * Script to fix information disclosure in API endpoints
 *
 * Replaces patterns like:
 *   error: 'Internal server error',
 *   message: error instanceof Error ? error.message : 'Unknown error'
 *
 * With:
 *   const { sanitizeError } = await import('../utils/error-handler.js');
 *   error: sanitizeError(error, 'context')
 */

const fs = require('fs');
const path = require('path');

// Patterns to fix
const patterns = [
  {
    // Pattern 1: error + message fields
    find: /error: ['"]Internal server error['"],\s*message: error instanceof Error \? error\.message : ['"]Unknown error['"]/g,
    replace: (match, offset, string) => {
      // Determine context from filename and surrounding code
      return `error: sanitizeError(error, 'processing request')`;
    }
  },
  {
    // Pattern 2: details: error.message
    find: /details: error\.message([,\s}])/g,
    replace: 'details: sanitizeError(error)$1'
  },
  {
    // Pattern 3: details: insertError.message, updateError.message, etc.
    find: /details: (\w+Error)\.message([,\s}])/g,
    replace: 'details: sanitizeError($1)$2'
  },
  {
    // Pattern 4: code: error.code, hint: error.hint
    find: /code: error\.code,\s*hint: error\.hint/g,
    replace: '// code and hint removed to prevent information disclosure'
  },
  {
    // Pattern 5: error_message: error instanceof Error ? error.message : 'Unknown error'
    find: /error_message: error instanceof Error \? error\.message : ['"]Unknown error['"]/g,
    replace: `error_message: sanitizeError(error)`
  }
];

// Files to process
const filesToFix = [
  'api/tasks.ts',
  'api/contacts.ts',
  'api/funders.ts',
  'api/funder-interactions.ts',
  'api/saved.ts',
  'api/saved-status.ts',
  'api/approval-requests.ts',
  'api/approval-workflows.ts',
  'api/notifications.ts',
  'api/activity.ts',
  'api/alerts.ts',
  'api/budgets.ts',
  'api/compliance.ts',
  'api/disbursements.ts',
  'api/payment-schedules.ts',
  'api/import.ts',
  'api/views.ts',
  'api/scheduled-reports.ts',
  'api/recent-searches.ts',
  'api/openai-proxy.ts',
  'api/preflight-checklist.ts',
  'api/metrics.ts',
  'api/documents/upload.ts',
  'api/documents/download.ts',
  'api/documents/delete.ts',
  'api/documents/list.ts',
  'api/documents/quota.ts',
  'api/data-export/request.ts',
  'api/data-export/download.ts',
  'api/reports/generate-content.ts',
  'api/reports/agency-program-breakdown.ts',
  'api/grants/search.ts',
  'api/grants/nofo-summary.ts',
  'api/grants/fetch-pdf.ts',
  'api/grants/search-catalog.ts',
  'api/grants/success-score.ts',
  'api/admin/organizations.ts',
  'api/admin/users.ts',
  'api/admin/update-plan.ts',
  'api/admin/update-username.ts',
  'api/admin/update-org-name.ts',
  'api/admin/fix-grant-titles.ts',
  'api/calendar/[orgId]/[token].ts',
  'api/cron/send-scheduled-reports.ts',
  'api/utils/notifications.ts',
  'api/webhooks.ts'
];

let totalFixed = 0;
let filesModified = 0;

filesToFix.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  let fileFixed = 0;

  // Apply each pattern
  patterns.forEach(({ find, replace }) => {
    const matches = content.match(find);
    if (matches) {
      fileFixed += matches.length;
      content = content.replace(find, replace);
    }
  });

  // Check if file needs sanitizeError import
  const needsImport = content !== originalContent &&
                      content.includes('sanitizeError(') &&
                      !content.includes("import('../utils/error-handler.js')") &&
                      !content.includes("import('./error-handler.js')");

  if (needsImport) {
    // Add import before the catch block that uses sanitizeError
    // Find the catch block that now uses sanitizeError
    const catchMatch = content.match(/(} catch \([^)]+\) {[^}]*console\.error[^}]*)/);
    if (catchMatch) {
      const catchBlock = catchMatch[0];
      const newCatchBlock = catchBlock.replace(
        /(console\.error\([^;]+;)/,
        `$1\n    // Import sanitizeError from error-handler\n    const { sanitizeError } = await import('../utils/error-handler.js');`
      );
      content = content.replace(catchBlock, newCatchBlock);
    }
  }

  // Only write if content changed
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed ${fileFixed} issue(s) in ${filePath}`);
    filesModified++;
    totalFixed += fileFixed;
  }
});

console.log(`\n🎉 Done! Fixed ${totalFixed} issue(s) across ${filesModified} file(s)`);
