import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Document Delete API
 *
 * Performs soft delete of documents
 * Only document owner or org admins can delete
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'DELETE') {
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

    const { document_id, permanent = false } = req.body;

    if (!document_id) {
      return res.status(400).json({ error: 'document_id is required' });
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('grant_documents')
      .select('*')
      .eq('id', document_id)
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

    // Check permissions: must be document owner OR admin/owner
    const isOwner = document.uploaded_by === user.id;
    const isAdmin = ['admin', 'owner'].includes(membership.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Only document owner or organization admins can delete documents'
      });
    }

    if (permanent && !isAdmin) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Only organization admins can permanently delete documents'
      });
    }

    if (permanent) {
      // Permanent deletion - remove from storage and database
      if (document.storage_provider === 'supabase') {
        const { error: storageError } = await supabase
          .storage
          .from('grant-documents')
          .remove([document.storage_url]);

        if (storageError) {
          console.error('Error deleting from storage:', storageError);
          // Continue anyway - might already be deleted
        }
      }

      // Delete from database (will trigger quota update)
      const { error: deleteError } = await supabase
        .from('grant_documents')
        .delete()
        .eq('id', document_id);

      if (deleteError) {
        console.error('Error deleting document:', deleteError);
        return res.status(500).json({
          error: 'Failed to delete document',
          details: deleteError.message
        });
      }

      return res.status(200).json({
        message: 'Document permanently deleted',
        document_id,
      });
    }

    // Soft delete - mark as deleted
    const { error: updateError } = await supabase
      .from('grant_documents')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', document_id);

    if (updateError) {
      console.error('Error soft deleting document:', updateError);
      return res.status(500).json({
        error: 'Failed to delete document',
        details: updateError.message
      });
    }

    // Get updated quota
    const { data: quota } = await supabase
      .from('organization_storage_quotas')
      .select('*')
      .eq('org_id', document.org_id)
      .single();

    return res.status(200).json({
      message: 'Document deleted successfully',
      document_id,
      quota,
    });

  } catch (error) {
    console.error('Document delete error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
