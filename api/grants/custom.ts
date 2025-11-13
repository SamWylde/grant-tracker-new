/**
 * Custom Grant Entry API
 *
 * POST /api/grants/custom - Create a custom grant
 * Includes validation for manual grant entry
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { CustomGrantAdapter, type CustomGrantInput } from '../../lib/grants/adapters/CustomGrantAdapter';
import type { GrantSource } from '../../lib/grants/types';
import { GoogleCalendarService } from '../../lib/google-calendar/GoogleCalendarService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get user's org_id from request
  const { org_id, grant_data } = req.body;

  if (!org_id) {
    return res.status(400).json({ error: 'org_id is required' });
  }

  if (!grant_data) {
    return res.status(400).json({ error: 'grant_data is required' });
  }

  // Verify user is member of the organization
  const { data: membership } = await supabase
    .from('org_members')
    .select('*')
    .eq('org_id', org_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return res.status(403).json({ error: 'Access denied to this organization' });
  }

  try {
    // Get custom source
    const { data: customSource, error: sourceError } = await supabase
      .from('grant_sources')
      .select('*')
      .eq('source_key', 'custom')
      .single();

    if (sourceError || !customSource) {
      return res.status(500).json({ error: 'Custom source not configured' });
    }

    // Create adapter
    const adapter = new CustomGrantAdapter(customSource as GrantSource);

    // Validate input
    const validation = adapter.validateGrantInput(grant_data as CustomGrantInput);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
      });
    }

    // Normalize the grant
    const normalized = adapter.normalizeGrant(grant_data);

    // Insert into catalog
    const { data: catalogGrant, error: catalogError } = await supabase
      .from('grants_catalog')
      .insert({
        source_id: customSource.id,
        source_key: customSource.source_key,
        external_id: normalized.external_id,
        title: normalized.title,
        description: normalized.description,
        agency: normalized.agency,
        opportunity_number: normalized.opportunity_number,
        estimated_funding: normalized.estimated_funding,
        award_floor: normalized.award_floor,
        award_ceiling: normalized.award_ceiling,
        expected_awards: normalized.expected_awards,
        funding_category: normalized.funding_category,
        eligibility_applicants: normalized.eligibility_applicants,
        cost_sharing_required: normalized.cost_sharing_required,
        posted_date: normalized.posted_date,
        open_date: normalized.open_date,
        close_date: normalized.close_date,
        opportunity_status: normalized.opportunity_status,
        cfda_numbers: normalized.cfda_numbers,
        aln_codes: normalized.aln_codes,
        source_url: normalized.source_url,
        application_url: normalized.application_url,
        content_hash: normalized.content_hash,
        is_active: true,
      })
      .select()
      .single();

    if (catalogError) {
      console.error('Error inserting grant:', catalogError);
      return res.status(500).json({ error: 'Failed to create grant' });
    }

    // Also save to org_grants_saved
    const { data: savedGrant, error: saveError } = await supabase
      .from('org_grants_saved')
      .insert({
        org_id,
        user_id: user.id,
        external_source: 'custom',
        external_id: normalized.external_id,
        catalog_grant_id: catalogGrant.id,
        title: normalized.title,
        agency: normalized.agency,
        aln: normalized.aln_codes?.[0],
        open_date: normalized.open_date,
        close_date: normalized.close_date,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving grant to org:', saveError);
      // Don't fail - grant is in catalog
    }

    // Sync with Google Calendar if grant was saved (async, don't wait)
    if (savedGrant) {
      try {
        const calendarService = new GoogleCalendarService(supabase);
        void calendarService.syncGrant(savedGrant, org_id);
      } catch (calErr) {
        console.error('Exception syncing custom grant with Google Calendar:', calErr);
        // Continue even if calendar sync fails
      }
    }

    return res.status(201).json({
      message: 'Custom grant created successfully',
      grant: catalogGrant,
      saved_grant: savedGrant,
    });
  } catch (error) {
    console.error('Error creating custom grant:', error);
    return res.status(500).json({
      error: 'Failed to create grant',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
