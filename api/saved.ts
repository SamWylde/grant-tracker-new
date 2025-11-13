import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendNotifications } from './utils/notifications';
import { GoogleCalendarService } from '../lib/google-calendar/GoogleCalendarService';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

interface SavedGrantRequest {
  org_id: string;
  user_id: string;
  external_id: string;
  title: string;
  agency?: string;
  aln?: string;
  open_date?: string;
  close_date?: string;
  loi_deadline?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigned_to?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Initialize Supabase client
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        // List saved grants for an organization
        const { org_id, format } = req.query;

        if (!org_id || typeof org_id !== 'string') {
          return res.status(400).json({ error: 'org_id is required' });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this organization' });
        }

        const { data, error } = await supabase
          .from('org_grants_saved')
          .select('*')
          .eq('org_id', org_id)
          .order('saved_at', { ascending: false});

        if (error) {
          console.error('Error fetching saved grants:', error);
          return res.status(500).json({ error: 'Failed to fetch saved grants' });
        }

        // Filter out any grants with null org_id and log them
        const validGrants = (data || []).filter(grant => {
          if (!grant.org_id) {
            console.error('[saved API] Found grant with null org_id:', grant.id);
            return false;
          }
          return true;
        });

        if (validGrants.length !== data?.length) {
          console.warn(`[saved API] Filtered out ${(data?.length || 0) - validGrants.length} grants with null org_id`);
        }

        // CSV export
        if (format === 'csv') {
          // Convert to CSV
          const csvHeader = [
            'Title',
            'Agency',
            'ALN',
            'Status',
            'Priority',
            'Open Date',
            'Close Date',
            'LOI Deadline',
            'Assigned To',
            'Notes',
            'Saved At',
            'External ID',
            'External Source'
          ].join(',');

          const csvRows = validGrants.map(grant => {
            // Escape CSV values
            const escape = (val: any) => {
              if (val === null || val === undefined) return '';
              const str = String(val);
              // Escape quotes and wrap in quotes if contains comma, quote, or newline
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            };

            return [
              escape(grant.title),
              escape(grant.agency),
              escape(grant.aln),
              escape(grant.status),
              escape(grant.priority),
              escape(grant.open_date),
              escape(grant.close_date),
              escape(grant.loi_deadline),
              escape(grant.assigned_to),
              escape(grant.notes),
              escape(grant.saved_at),
              escape(grant.external_id),
              escape(grant.external_source)
            ].join(',');
          });

          const csv = [csvHeader, ...csvRows].join('\n');

          // Set CSV headers
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="grants-export-${new Date().toISOString().split('T')[0]}.csv"`);

          return res.status(200).send(csv);
        }

        // Enrich grants with descriptions from Grants.gov if missing
        const grantsWithoutDescriptions = validGrants.filter(g => !g.description);

        if (grantsWithoutDescriptions.length > 0) {
          console.log(`[Saved API] Fetching ${grantsWithoutDescriptions.length} descriptions from Grants.gov`);

          // Fetch descriptions in batches
          const batchSize = 10;
          for (let i = 0; i < grantsWithoutDescriptions.length; i += batchSize) {
            const batch = grantsWithoutDescriptions.slice(i, i + batchSize);

            await Promise.all(
              batch.map(async (grant) => {
                try {
                  const detailsResponse = await fetch('https://api.grants.gov/v1/api/fetchOpportunity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ opportunityId: Number(grant.external_id) }),
                  });

                  if (detailsResponse.ok) {
                    const detailsData = await detailsResponse.json();
                    const description = detailsData?.data?.synopsis?.synopsisDesc || null;

                    if (description) {
                      // Update in-memory grant
                      grant.description = description;

                      // Update database asynchronously
                      void (async () => {
                        try {
                          await supabase
                            .from('org_grants_saved')
                            .update({ description })
                            .eq('id', grant.id);
                          console.log(`[Saved API] Cached description for grant ${grant.id}`);
                        } catch (err) {
                          console.warn(`[Saved API] Failed to cache description:`, err);
                        }
                      })();
                    }
                  }
                } catch (err) {
                  console.warn(`[Saved API] Failed to fetch description for grant ${grant.external_id}:`, err);
                }
              })
            );
          }
        }

        return res.status(200).json({ grants: validGrants });
      }

      case 'POST': {
        // Save a new grant
        const grantData = req.body as SavedGrantRequest;

        if (!grantData.org_id || !grantData.user_id || !grantData.external_id || !grantData.title) {
          return res.status(400).json({
            error: 'Missing required fields: org_id, user_id, external_id, title'
          });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', grantData.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this organization' });
        }

        // Ensure the user_id in the request matches the authenticated user
        if (grantData.user_id !== user.id) {
          return res.status(403).json({ error: 'Cannot save grants for other users' });
        }

        // Helper to convert MM/DD/YYYY to ISO format
        const convertToISO = (dateStr: string | undefined | null): string | null => {
          if (!dateStr) return null;
          try {
            // If already in ISO format, return as-is
            if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
              return dateStr;
            }
            // Convert MM/DD/YYYY to YYYY-MM-DD
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const [month, day, year] = parts;
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            return dateStr; // Return as-is if format is unexpected
          } catch {
            return dateStr;
          }
        };

        const { data, error } = await supabase
          .from('org_grants_saved')
          .insert({
            org_id: grantData.org_id,
            user_id: grantData.user_id,
            external_source: 'grants.gov',
            external_id: grantData.external_id,
            title: grantData.title,
            agency: grantData.agency || null,
            aln: grantData.aln || null,
            open_date: convertToISO(grantData.open_date),
            close_date: convertToISO(grantData.close_date),
            loi_deadline: convertToISO(grantData.loi_deadline),
            description: grantData.description || null,
            status: grantData.status || 'researching', // Default to researching if not provided
            priority: grantData.priority || 'medium', // Default to medium if not provided
            assigned_to: grantData.assigned_to || null,
          })
          .select()
          .single();

        if (error) {
          // Check for unique constraint violation (already saved)
          if (error.code === '23505') {
            return res.status(409).json({ error: 'Grant already saved' });
          }
          console.error('Error saving grant:', error);
          return res.status(500).json({
            error: 'Failed to save grant',
            details: error.message,
            code: error.code,
            hint: error.hint
          });
        }

        // Create default tasks for the grant
        try {
          const { error: tasksError } = await supabase.rpc('create_default_grant_tasks', {
            p_grant_id: data.id,
            p_org_id: grantData.org_id,
            p_user_id: grantData.user_id,
          });

          if (tasksError) {
            console.error('Error creating default tasks:', tasksError);
            // Don't fail the request if task creation fails, just log it
          }
        } catch (taskErr) {
          console.error('Exception creating default tasks:', taskErr);
          // Continue even if task creation fails
        }

        // Send notifications for grant.saved event
        try {
          const origin = req.headers.origin || 'https://grantcue.com';
          await sendNotifications({
            event: 'grant.saved',
            org_id: grantData.org_id,
            grant_id: data.id,
            grant_title: data.title,
            grant_agency: data.agency,
            grant_deadline: data.close_date,
            action_url: `${origin}/grants/${data.id}`,
            metadata: {
              status: data.status,
              priority: data.priority,
            },
          });
        } catch (notificationError) {
          console.error('Error sending grant.saved notifications:', notificationError);
          // Don't fail the request if notifications fail
        }

        // Sync with Google Calendar (async, don't wait)
        try {
          const calendarService = new GoogleCalendarService(supabase);
          void calendarService.syncGrant(data, grantData.org_id);
        } catch (calErr) {
          console.error('Exception syncing with Google Calendar:', calErr);
          // Continue even if calendar sync fails
        }

        return res.status(201).json({ grant: data });
      }

      case 'PATCH': {
        // Update a saved grant (notes, status, priority, etc.)
        const { id } = req.query;
        const updates = req.body;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Get the grant to verify access
        const { data: grant } = await supabase
          .from('org_grants_saved')
          .select('org_id, close_date, google_calendar_event_id')
          .eq('id', id)
          .single();

        if (!grant) {
          return res.status(404).json({ error: 'Grant not found' });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', grant.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this grant' });
        }

        // Build the update object - only update allowed fields
        const allowedFields = [
          'notes',
          'status',
          'priority',
          'assigned_to',
          'description',
          'title',
          'agency',
          'aln',
          'open_date',
          'close_date',
          'loi_deadline'
        ];

        const updateData: any = {};
        for (const field of allowedFields) {
          if (field in updates) {
            updateData[field] = updates[field];
          }
        }

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        // Perform the update
        const { data: updated, error } = await supabase
          .from('org_grants_saved')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error updating grant:', error);
          return res.status(500).json({
            error: 'Failed to update grant',
            details: error.message
          });
        }

        // Send notifications for grant.updated event
        try {
          const origin = req.headers.origin || 'https://grantcue.com';
          await sendNotifications({
            event: 'grant.updated',
            org_id: updated.org_id,
            grant_id: updated.id,
            grant_title: updated.title,
            grant_agency: updated.agency,
            grant_deadline: updated.close_date,
            action_url: `${origin}/grants/${updated.id}`,
            metadata: {
              updated_fields: Object.keys(updateData),
              status: updated.status,
              priority: updated.priority,
            },
          });
        } catch (notificationError) {
          console.error('Error sending grant.updated notifications:', notificationError);
          // Don't fail the request if notifications fail
        }

        // Sync with Google Calendar if deadline or title/agency changed (async, don't wait)
        try {
          const deadlineChanged = 'close_date' in updateData && updateData.close_date !== grant.close_date;
          const detailsChanged = 'title' in updateData || 'agency' in updateData || 'description' in updateData;

          if (deadlineChanged || detailsChanged) {
            const calendarService = new GoogleCalendarService(supabase);
            void calendarService.syncGrant(updated, updated.org_id);
          }
        } catch (calErr) {
          console.error('Exception syncing with Google Calendar:', calErr);
          // Continue even if calendar sync fails
        }

        return res.status(200).json({ grant: updated });
      }

      case 'DELETE': {
        // Delete a saved grant by ID
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Verify the grant belongs to an organization the user is a member of
        const { data: grant } = await supabase
          .from('org_grants_saved')
          .select('org_id, google_calendar_event_id, title, agency, close_date, external_id, description')
          .eq('id', id)
          .single();

        if (!grant) {
          return res.status(404).json({ error: 'Grant not found' });
        }

        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', grant.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this grant' });
        }

        // Delete from Google Calendar first (async, don't wait)
        try {
          if (grant.google_calendar_event_id) {
            const calendarService = new GoogleCalendarService(supabase);
            void calendarService.handleGrantDeletion(
              { ...grant, id } as any,
              grant.org_id
            );
          }
        } catch (calErr) {
          console.error('Exception deleting from Google Calendar:', calErr);
          // Continue even if calendar deletion fails
        }

        const { error } = await supabase
          .from('org_grants_saved')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting saved grant:', error);
          return res.status(500).json({ error: 'Failed to delete saved grant' });
        }

        return res.status(200).json({ message: 'Grant removed from pipeline' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in saved grants API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
