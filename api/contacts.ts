import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

interface ContactRequest {
  org_id: string;
  funder_id: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  notes?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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
        // List contacts for a funder or organization
        const { org_id, funder_id, id } = req.query;

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

        if (id && typeof id === 'string') {
          // Get single contact
          const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select(`
              *,
              funder:funders(id, name)
            `)
            .eq('id', id)
            .eq('org_id', org_id)
            .single();

          if (contactError) {
            console.error('Error fetching contact:', contactError);
            return res.status(500).json({ error: 'Failed to fetch contact' });
          }

          if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
          }

          return res.status(200).json({ contact });
        } else {
          // List contacts
          let query = supabase
            .from('contacts')
            .select(`
              *,
              funder:funders(id, name)
            `)
            .eq('org_id', org_id)
            .order('name', { ascending: true });

          if (funder_id && typeof funder_id === 'string') {
            query = query.eq('funder_id', funder_id);
          }

          const { data, error } = await query;

          if (error) {
            console.error('Error fetching contacts:', error);
            return res.status(500).json({ error: 'Failed to fetch contacts' });
          }

          return res.status(200).json({ contacts: data });
        }
      }

      case 'POST': {
        // Create a new contact
        const contactData = req.body as ContactRequest;

        if (!contactData.org_id || !contactData.funder_id || !contactData.name) {
          return res.status(400).json({
            error: 'Missing required fields: org_id, funder_id, name'
          });
        }

        // Verify user is a member of the organization
        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', contactData.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this organization' });
        }

        // Verify the funder belongs to the organization
        const { data: funder } = await supabase
          .from('funders')
          .select('id')
          .eq('id', contactData.funder_id)
          .eq('org_id', contactData.org_id)
          .single();

        if (!funder) {
          return res.status(404).json({ error: 'Funder not found or does not belong to this organization' });
        }

        const { data, error } = await supabase
          .from('contacts')
          .insert({
            org_id: contactData.org_id,
            funder_id: contactData.funder_id,
            name: contactData.name,
            email: contactData.email || null,
            phone: contactData.phone || null,
            title: contactData.title || null,
            notes: contactData.notes || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating contact:', error);
          return res.status(500).json({ error: 'Failed to create contact' });
        }

        return res.status(201).json({ contact: data });
      }

      case 'PATCH': {
        // Update an existing contact
        const { id } = req.query;
        const updates = req.body;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Verify the contact belongs to an organization the user is a member of
        const { data: contact } = await supabase
          .from('contacts')
          .select('org_id')
          .eq('id', id)
          .single();

        if (!contact) {
          return res.status(404).json({ error: 'Contact not found' });
        }

        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', contact.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this contact' });
        }

        // Build the update object
        const updateData: any = {};
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.email !== undefined) updateData.email = updates.email;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        if (updates.funder_id !== undefined) updateData.funder_id = updates.funder_id;

        const { data, error } = await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error updating contact:', error);
          return res.status(500).json({ error: 'Failed to update contact' });
        }

        return res.status(200).json({ contact: data });
      }

      case 'DELETE': {
        // Delete a contact
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'id is required' });
        }

        // Verify the contact belongs to an organization the user is a member of
        const { data: contact } = await supabase
          .from('contacts')
          .select('org_id')
          .eq('id', id)
          .single();

        if (!contact) {
          return res.status(404).json({ error: 'Contact not found' });
        }

        const { data: membership } = await supabase
          .from('org_members')
          .select('*')
          .eq('org_id', contact.org_id)
          .eq('user_id', user.id)
          .single();

        if (!membership) {
          return res.status(403).json({ error: 'Access denied to this contact' });
        }

        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting contact:', error);
          return res.status(500).json({ error: 'Failed to delete contact' });
        }

        return res.status(200).json({ message: 'Contact deleted successfully' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in contacts API:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('../utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, 'processing request')
    });
  }
}
