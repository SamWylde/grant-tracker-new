import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { logError, createRequestLogger } from './utils/logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logError('Missing Supabase environment variables', undefined, { module: 'funder-interactions' });
}

interface InteractionRequest {
  org_id: string;
  funder_id: string;
  contact_id?: string;
  interaction_type: string;
  interaction_date: string;
  notes: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const logger = createRequestLogger(req, { module: 'funder-interactions' });

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
        // List interactions for a funder
        const { org_id, funder_id } = req.query;

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

        let query = supabase
          .from('funder_interactions')
          .select(`
            *,
            funder:funders(id, name),
            contact:contacts(id, name),
            user:user_profiles(user_id, full_name)
          `)
          .eq('org_id', org_id)
          .order('interaction_date', { ascending: false });

        if (funder_id && typeof funder_id === 'string') {
          query = query.eq('funder_id', funder_id);
        }

        const { data, error } = await query;

        if (error) {
          logger.error('Error fetching interactions', error, { orgId: org_id, funderId: funder_id });
          return res.status(500).json({ error: 'Failed to fetch interactions' });
        }

        return res.status(200).json({ interactions: data });
      }

      case 'POST': {
        // Create a new interaction
        const interactionData = req.body as InteractionRequest;

        if (!interactionData.org_id || !interactionData.funder_id ||
            !interactionData.interaction_type || !interactionData.interaction_date ||
            !interactionData.notes) {
          return res.status(400).json({
            error: 'Missing required fields: org_id, funder_id, interaction_type, interaction_date, notes'
          });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', interactionData.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this organization' });
        }

        // Verify the funder belongs to the organization
        const { data: funder } = await supabase
          .from('funders')
          .select('id')
          .eq('id', interactionData.funder_id)
          .eq('org_id', interactionData.org_id)
          .single();

        if (!funder) {
          return res.status(404).json({ error: 'Funder not found or does not belong to this organization' });
        }

        // If contact_id is provided, verify it belongs to the funder
        if (interactionData.contact_id) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('id')
            .eq('id', interactionData.contact_id)
            .eq('funder_id', interactionData.funder_id)
            .single();

          if (!contact) {
            return res.status(404).json({ error: 'Contact not found or does not belong to this funder' });
          }
        }

        const { data, error } = await supabase
          .from('funder_interactions')
          .insert({
            org_id: interactionData.org_id,
            funder_id: interactionData.funder_id,
            contact_id: interactionData.contact_id || null,
            user_id: user.id,
            interaction_type: interactionData.interaction_type,
            interaction_date: interactionData.interaction_date,
            notes: interactionData.notes,
          })
          .select()
          .single();

        if (error) {
          logger.error('Error creating interaction', error, {
            orgId: interactionData.org_id,
            funderId: interactionData.funder_id
          });
          return res.status(500).json({ error: 'Failed to create interaction' });
        }

        return res.status(201).json({ interaction: data });
      }

      case 'PATCH': {
        // Update an existing interaction
        const { id } = req.query;
        const updates = req.body;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Verify the interaction belongs to an organization the user is a member of
        const { data: interaction } = await supabase
          .from('funder_interactions')
          .select('org_id, user_id')
          .eq('id', id)
          .single();

        if (!interaction) {
          return res.status(404).json({ error: 'Interaction not found' });
        }

        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', interaction.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this interaction' });
        }

        // Build the update object
        const updateData: any = {};
        if (updates.interaction_type !== undefined) updateData.interaction_type = updates.interaction_type;
        if (updates.interaction_date !== undefined) updateData.interaction_date = updates.interaction_date;
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        if (updates.contact_id !== undefined) updateData.contact_id = updates.contact_id;

        const { data, error } = await supabase
          .from('funder_interactions')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          logger.error('Error updating interaction', error, { interactionId: id });
          return res.status(500).json({ error: 'Failed to update interaction' });
        }

        return res.status(200).json({ interaction: data });
      }

      case 'DELETE': {
        // Delete an interaction
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Verify the interaction belongs to an organization the user is a member of
        const { data: interaction } = await supabase
          .from('funder_interactions')
          .select('org_id, user_id')
          .eq('id', id)
          .single();

        if (!interaction) {
          return res.status(404).json({ error: 'Interaction not found' });
        }

        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', interaction.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this interaction' });
        }

        const { error } = await supabase
          .from('funder_interactions')
          .delete()
          .eq('id', id);

        if (error) {
          logger.error('Error deleting interaction', error, { interactionId: id });
          return res.status(500).json({ error: 'Failed to delete interaction' });
        }

        return res.status(200).json({ message: 'Interaction deleted successfully' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('Error in funder-interactions API', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('./utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, 'processing request')
    });
  }
}
