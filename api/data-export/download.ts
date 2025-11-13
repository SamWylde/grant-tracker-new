/**
 * Data Export Download Endpoint
 *
 * Secure download endpoint with token-based authentication and expiration
 * Handles downloading personal data exports with audit logging
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Handler for export file downloads
 * Uses secure token authentication instead of user session
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Download token required' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Use service role key for token verification
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Find export request by download token
    const { data: exportRequest, error: fetchError } = await supabase
      .from('data_export_requests')
      .select('*')
      .eq('download_token', token)
      .eq('status', 'completed')
      .single();

    if (fetchError || !exportRequest) {
      return res.status(404).json({ error: 'Export not found or invalid token' });
    }

    // Check if export has expired
    if (exportRequest.expires_at) {
      const expiresAt = new Date(exportRequest.expires_at);
      const now = new Date();

      if (now > expiresAt) {
        // Mark as expired
        await supabase
          .from('data_export_requests')
          .update({ status: 'expired' })
          .eq('id', exportRequest.id);

        return res.status(410).json({
          error: 'Export has expired',
          message: 'This download link has expired. Please request a new export.',
        });
      }
    }

    // Regenerate the export data (in production, this would fetch from storage)
    // For now, we'll regenerate it to demonstrate the functionality
    const exportData = await collectUserData(supabase, exportRequest.user_id);

    // Add metadata to export
    const finalExport = {
      ...exportData,
      export_metadata: {
        export_id: exportRequest.id,
        requested_at: exportRequest.requested_at,
        generated_at: new Date().toISOString(),
        format: exportRequest.format,
        download_count: exportRequest.download_count + 1,
        expires_at: exportRequest.expires_at,
      },
    };

    // Increment download count and track download
    await supabase
      .from('data_export_requests')
      .update({
        download_count: exportRequest.download_count + 1,
        downloaded_at: new Date().toISOString(),
      })
      .eq('id', exportRequest.id);

    // Determine filename and content type
    let filename: string;
    let contentType: string;
    let content: string;

    if (exportRequest.format === 'json' || exportRequest.format === 'both') {
      filename = `personal-data-export-${exportRequest.user_id}-${exportRequest.id}.json`;
      contentType = 'application/json';
      content = JSON.stringify(finalExport, null, 2);
    } else {
      // CSV format
      filename = `personal-data-export-${exportRequest.user_id}-${exportRequest.id}.csv`;
      contentType = 'text/csv';
      content = convertToCSV(finalExport);
    }

    // Set headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(content, 'utf8'));
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send the file
    return res.status(200).send(content);
  } catch (error) {
    console.error('Error downloading export:', error);
    return res.status(500).json({
      error: 'Failed to download export',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Collect all personal data for a user (same as in request.ts)
 */
async function collectUserData(supabase: any, userId: string) {
  const data: any = {
    export_info: {
      generated_at: new Date().toISOString(),
      user_id: userId,
      data_sources: [],
    },
    user_profile: null,
    user_preferences: null,
    organization_memberships: [],
    grants: [],
    tasks: [],
    grant_comments: [],
    task_comments: [],
    activity_log: [],
    documents: [],
    mentions: [],
    approval_requests: [],
    searches: [],
  };

  // User Profile
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  data.user_profile = userProfile;
  if (userProfile) data.export_info.data_sources.push('user_profiles');

  // User Preferences
  const { data: userPreferences } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  data.user_preferences = userPreferences;
  if (userPreferences) data.export_info.data_sources.push('user_preferences');

  // Organization Memberships
  const { data: orgMembers } = await supabase
    .from('org_members')
    .select(`
      *,
      organizations (
        id,
        name,
        primary_state,
        focus_areas,
        created_at
      )
    `)
    .eq('user_id', userId);
  data.organization_memberships = orgMembers || [];
  if (orgMembers && orgMembers.length > 0) data.export_info.data_sources.push('org_members');

  // Grants (saved or created by user)
  const { data: grants } = await supabase
    .from('org_grants_saved')
    .select('*')
    .eq('user_id', userId);
  data.grants = grants || [];
  if (grants && grants.length > 0) data.export_info.data_sources.push('org_grants_saved');

  // Tasks (created by or assigned to user)
  const { data: tasks } = await supabase
    .from('grant_tasks')
    .select('*')
    .or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
  data.tasks = tasks || [];
  if (tasks && tasks.length > 0) data.export_info.data_sources.push('grant_tasks');

  // Grant Comments
  const { data: grantComments } = await supabase
    .from('grant_comments')
    .select('*')
    .eq('user_id', userId);
  data.grant_comments = grantComments || [];
  if (grantComments && grantComments.length > 0) data.export_info.data_sources.push('grant_comments');

  // Task Comments
  const { data: taskComments } = await supabase
    .from('task_comments')
    .select('*')
    .eq('user_id', userId);
  data.task_comments = taskComments || [];
  if (taskComments && taskComments.length > 0) data.export_info.data_sources.push('task_comments');

  // Activity Log
  const { data: activityLog } = await supabase
    .from('grant_activity_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000); // Limit to most recent 1000 activities
  data.activity_log = activityLog || [];
  if (activityLog && activityLog.length > 0) data.export_info.data_sources.push('grant_activity_log');

  // Documents uploaded by user
  const { data: documents } = await supabase
    .from('grant_documents')
    .select('id, file_name, file_type, file_size, description, document_category, created_at, updated_at')
    .eq('uploaded_by', userId);
  data.documents = documents || [];
  if (documents && documents.length > 0) data.export_info.data_sources.push('grant_documents');

  // Mentions
  const { data: mentions } = await supabase
    .from('mention_notifications')
    .select('*')
    .eq('user_id', userId);
  data.mentions = mentions || [];
  if (mentions && mentions.length > 0) data.export_info.data_sources.push('mention_notifications');

  // Approval Requests
  const { data: approvalRequests } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('requested_by', userId);
  data.approval_requests = approvalRequests || [];
  if (approvalRequests && approvalRequests.length > 0) data.export_info.data_sources.push('approval_requests');

  // Recent Searches
  const { data: searches } = await supabase
    .from('recent_searches')
    .select('*')
    .eq('user_id', userId)
    .order('searched_at', { ascending: false })
    .limit(100); // Limit to most recent 100 searches
  data.searches = searches || [];
  if (searches && searches.length > 0) data.export_info.data_sources.push('recent_searches');

  // Calculate totals
  data.export_info.totals = {
    organizations: data.organization_memberships.length,
    grants: data.grants.length,
    tasks: data.tasks.length,
    grant_comments: data.grant_comments.length,
    task_comments: data.task_comments.length,
    activity_entries: data.activity_log.length,
    documents: data.documents.length,
    mentions: data.mentions.length,
    approval_requests: data.approval_requests.length,
    searches: data.searches.length,
  };

  return data;
}

/**
 * Convert export data to CSV format
 * Creates multiple CSV sections for different data types
 */
function convertToCSV(data: any): string {
  const sections: string[] = [];

  // Helper to escape CSV values
  const escape = (value: any): string => {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Add export info header
  sections.push('=== PERSONAL DATA EXPORT ===');
  sections.push(`Generated At:,${escape(data.export_info.generated_at)}`);
  sections.push(`User ID:,${escape(data.export_info.user_id)}`);
  sections.push('');

  // User Profile
  if (data.user_profile) {
    sections.push('=== USER PROFILE ===');
    sections.push('Field,Value');
    Object.entries(data.user_profile).forEach(([key, value]) => {
      sections.push(`${escape(key)},${escape(value)}`);
    });
    sections.push('');
  }

  // Grants
  if (data.grants && data.grants.length > 0) {
    sections.push('=== GRANTS ===');
    const grantKeys = Object.keys(data.grants[0]);
    sections.push(grantKeys.map(escape).join(','));
    data.grants.forEach((grant: any) => {
      sections.push(grantKeys.map((key) => escape(grant[key])).join(','));
    });
    sections.push('');
  }

  // Tasks
  if (data.tasks && data.tasks.length > 0) {
    sections.push('=== TASKS ===');
    const taskKeys = Object.keys(data.tasks[0]);
    sections.push(taskKeys.map(escape).join(','));
    data.tasks.forEach((task: any) => {
      sections.push(taskKeys.map((key) => escape(task[key])).join(','));
    });
    sections.push('');
  }

  // Comments
  if (data.grant_comments && data.grant_comments.length > 0) {
    sections.push('=== GRANT COMMENTS ===');
    const commentKeys = Object.keys(data.grant_comments[0]);
    sections.push(commentKeys.map(escape).join(','));
    data.grant_comments.forEach((comment: any) => {
      sections.push(commentKeys.map((key) => escape(comment[key])).join(','));
    });
    sections.push('');
  }

  // Summary
  sections.push('=== SUMMARY ===');
  sections.push('Category,Count');
  Object.entries(data.export_info.totals || {}).forEach(([key, value]) => {
    sections.push(`${escape(key)},${escape(value)}`);
  });

  return sections.join('\n');
}
