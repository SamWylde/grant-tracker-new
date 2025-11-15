import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Create Supabase client with user's token
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GET - List scheduled reports for user's organization
    if (req.method === 'GET') {
      const { org_id } = req.query;

      if (!org_id || typeof org_id !== 'string') {
        return res.status(400).json({ error: 'org_id is required' });
      }

      // Verify user is member of the org
      const { data: membership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this organization' });
      }

      // Get all scheduled reports for the org
      const { data: reports, error } = await supabase
        .from('scheduled_reports')
        .select('*')
        .eq('org_id', org_id)
        .order('report_type', { ascending: true });

      if (error) throw error;

      // Get delivery history
      const { data: deliveryHistory, error: historyError } = await supabase
        .from('report_delivery_log')
        .select('*')
        .eq('org_id', org_id)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (historyError) throw historyError;

      return res.status(200).json({
        reports: reports || [],
        deliveryHistory: deliveryHistory || [],
      });
    }

    // POST - Create a new scheduled report
    if (req.method === 'POST') {
      const {
        org_id,
        user_id,
        report_type,
        enabled,
        include_new_matches,
        include_upcoming_deadlines,
        include_team_activity,
        include_submissions,
        include_awards,
        include_pipeline_health,
        delivery_day,
        delivery_time,
        delivery_timezone,
        custom_template,
        custom_sections,
      } = req.body;

      if (!org_id || !report_type) {
        return res.status(400).json({ error: 'org_id and report_type are required' });
      }

      // Verify user has permission
      const { data: membership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', org_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this organization' });
      }

      // If creating org-wide report (user_id is null), must be admin
      if (!user_id && membership.role !== 'admin') {
        return res
          .status(403)
          .json({ error: 'Only admins can create org-wide reports' });
      }

      // If creating personal report, user_id must match authenticated user
      if (user_id && user_id !== user.id) {
        return res.status(403).json({ error: 'Cannot create reports for other users' });
      }

      const { data: report, error } = await supabase
        .from('scheduled_reports')
        .insert({
          org_id,
          user_id: user_id || null,
          report_type,
          enabled: enabled ?? true,
          include_new_matches: include_new_matches ?? true,
          include_upcoming_deadlines: include_upcoming_deadlines ?? true,
          include_team_activity: include_team_activity ?? true,
          include_submissions: include_submissions ?? true,
          include_awards: include_awards ?? true,
          include_pipeline_health: include_pipeline_health ?? true,
          delivery_day,
          delivery_time: delivery_time || '09:00:00',
          delivery_timezone: delivery_timezone || 'America/New_York',
          custom_template,
          custom_sections,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ report });
    }

    // PATCH - Update an existing scheduled report
    if (req.method === 'PATCH') {
      const { report_id } = req.query;
      const updateData = req.body;

      if (!report_id || typeof report_id !== 'string') {
        return res.status(400).json({ error: 'report_id is required' });
      }

      // Get the report to verify permissions
      const { data: existingReport, error: fetchError } = await supabase
        .from('scheduled_reports')
        .select('*, org_members!inner(role)')
        .eq('id', report_id)
        .eq('org_members.user_id', user.id)
        .single();

      if (fetchError || !existingReport) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Check permissions
      const membership = (existingReport as any).org_members;
      const isOrgWide = !existingReport.user_id;

      if (isOrgWide && membership.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update org-wide reports' });
      }

      if (!isOrgWide && existingReport.user_id !== user.id) {
        return res.status(403).json({ error: 'Cannot update other users\' reports' });
      }

      // Update the report
      const { data: updatedReport, error: updateError } = await supabase
        .from('scheduled_reports')
        .update(updateData)
        .eq('id', report_id)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.status(200).json({ report: updatedReport });
    }

    // DELETE - Delete a scheduled report
    if (req.method === 'DELETE') {
      const { report_id } = req.query;

      if (!report_id || typeof report_id !== 'string') {
        return res.status(400).json({ error: 'report_id is required' });
      }

      // Get the report to verify permissions
      const { data: existingReport, error: fetchError } = await supabase
        .from('scheduled_reports')
        .select('*, org_members!inner(role)')
        .eq('id', report_id)
        .eq('org_members.user_id', user.id)
        .single();

      if (fetchError || !existingReport) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Check permissions
      const membership = (existingReport as any).org_members;
      const isOrgWide = !existingReport.user_id;

      if (isOrgWide && membership.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can delete org-wide reports' });
      }

      if (!isOrgWide && existingReport.user_id !== user.id) {
        return res.status(403).json({ error: 'Cannot delete other users\' reports' });
      }

      // Delete the report
      const { error: deleteError } = await supabase
        .from('scheduled_reports')
        .delete()
        .eq('id', report_id);

      if (deleteError) throw deleteError;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in scheduled-reports API:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('../utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, 'processing request'),
    });
  }
}
