import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Document Download API
 *
 * Generates signed URLs for secure document downloads
 * Logs download activity for audit purposes
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Get auth token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { document_id, expires_in = 3600 } = req.body; // Default 1 hour

    if (!document_id) {
      return res.status(400).json({ error: 'document_id is required' });
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('grant_documents')
      .select('*')
      .eq('id', document_id)
      .is('deleted_at', null)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Verify user belongs to organization
    const { data: membership, error: membershipError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', document.org_id)
      .single();

    if (membershipError || !membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate signed URL for Supabase Storage
    if (document.storage_provider === 'supabase') {
      const { data: signedUrlData, error: signedUrlError } = await supabase
        .storage
        .from('grant-documents')
        .createSignedUrl(document.storage_url, Number(expires_in));

      if (signedUrlError) {
        console.error('Error generating signed URL:', signedUrlError);
        return res.status(500).json({
          error: 'Failed to generate download URL',
          details: signedUrlError.message
        });
      }

      // Log download action
      await supabase
        .from('grant_document_history')
        .insert({
          document_id: document.id,
          action: 'downloaded',
          changed_by: user.id,
          changes: {
            file_name: document.file_name,
            download_url_expires_at: new Date(Date.now() + Number(expires_in) * 1000).toISOString()
          },
          ip_address: req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string || null,
          user_agent: req.headers['user-agent'] || null,
        });

      return res.status(200).json({
        download_url: signedUrlData.signedUrl,
        expires_at: new Date(Date.now() + Number(expires_in) * 1000).toISOString(),
        file_name: document.file_name,
        file_size: document.file_size,
        file_type: document.file_type,
      });
    }

    // For external storage providers, return the direct URL
    return res.status(200).json({
      download_url: document.storage_url,
      file_name: document.file_name,
      file_size: document.file_size,
      file_type: document.file_type,
      provider: document.storage_provider,
    });

  } catch (error) {
    console.error('Document download error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
