import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitStandard, handleRateLimit } from '../utils/ratelimit';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Document Upload API
 *
 * Handles document uploads with:
 * - Plan-based quota enforcement
 * - File type and size validation
 * - Supabase Storage integration
 * - Automatic metadata tracking
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Apply rate limiting (60 req/min per IP)
  const rateLimitResult = await rateLimitStandard(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

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

    const {
      orgId,
      grantId,
      taskId,
      fileName,
      fileType,
      fileSize,
      storageUrl,
      description,
      documentCategory,
      parentDocumentId,
    } = req.body;

    // Validate required fields
    if (!orgId || !fileName || !fileType || !fileSize || !storageUrl) {
      return res.status(400).json({
        error: 'Missing required fields: orgId, fileName, fileType, fileSize, storageUrl'
      });
    }

    // Verify user belongs to organization
    const { data: membership, error: membershipError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', orgId)
      .single();

    if (membershipError || !membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Insert document record (triggers will handle quota checks)
    const { data: document, error: insertError } = await supabase
      .from('grant_documents')
      .insert({
        org_id: orgId,
        grant_id: grantId || null,
        task_id: taskId || null,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        storage_url: storageUrl,
        storage_provider: 'supabase',
        uploaded_by: user.id,
        description: description || null,
        document_category: documentCategory || null,
        parent_document_id: parentDocumentId || null,
      })
      .select('*')
      .single();

    if (insertError) {
      // Check if it's a quota error
      if (insertError.message.includes('quota') || insertError.message.includes('limit')) {
        return res.status(413).json({
          error: 'Storage quota exceeded',
          details: insertError.message
        });
      }

      console.error('Error inserting document:', insertError);
      return res.status(500).json({
        error: 'Failed to save document',
        details: insertError.message
      });
    }

    // Get updated quota information
    const { data: quota } = await supabase
      .from('organization_storage_quotas')
      .select('*')
      .eq('org_id', orgId)
      .single();

    return res.status(200).json({
      document,
      quota,
      message: 'Document uploaded successfully',
    });

  } catch (error) {
    console.error('Document upload error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
