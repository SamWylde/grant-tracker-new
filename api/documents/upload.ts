import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimitStandard, handleRateLimit } from '../utils/ratelimit';
import { ErrorHandlers, generateRequestId, wrapHandler } from '../utils/error-handler';

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
export default wrapHandler(async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const requestId = generateRequestId();
  // Apply rate limiting (60 req/min per IP)
  const rateLimitResult = await rateLimitStandard(req);
  if (handleRateLimit(res, rateLimitResult)) {
    return;
  }

  if (req.method !== 'POST') {
    return ErrorHandlers.methodNotAllowed(res, ['POST'], requestId);
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return ErrorHandlers.serverError(res, new Error('Server configuration error'), requestId);
  }

  // Get auth token from header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ErrorHandlers.unauthorized(res, 'Unauthorized', undefined, requestId);
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return ErrorHandlers.unauthorized(res, 'Invalid token', undefined, requestId);
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
    return ErrorHandlers.validation(
      res,
      'Missing required fields',
      { required: ['orgId', 'fileName', 'fileType', 'fileSize', 'storageUrl'] },
      requestId
    );
  }

  // Verify user belongs to organization
  const { data: membership, error: membershipError } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .single();

  if (membershipError || !membership) {
    return ErrorHandlers.forbidden(res, 'Access denied', undefined, requestId);
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
      return ErrorHandlers.quotaExceeded(res, 'Storage quota exceeded', insertError.message, requestId);
    }

    console.error('Error inserting document:', insertError);
    return ErrorHandlers.database(res, insertError, requestId);
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
});
