import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Document Quota API
 *
 * Returns current storage usage and limits for an organization
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
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

    const { org_id } = req.query;

    if (!org_id) {
      return res.status(400).json({ error: 'org_id is required' });
    }

    // Verify user belongs to organization
    const { data: membership, error: membershipError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', org_id)
      .single();

    if (membershipError || !membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get organization settings to determine plan
    const { data: settings, error: settingsError } = await supabase
      .from('organization_settings')
      .select('plan_name')
      .eq('org_id', org_id)
      .single();

    if (settingsError || !settings) {
      return res.status(500).json({ error: 'Failed to fetch organization settings' });
    }

    // Get plan limits
    const planLimits = {
      free: {
        max_storage_bytes: 52428800, // 50MB
        max_documents: 10,
        max_file_size_bytes: 5242880, // 5MB
      },
      starter: {
        max_storage_bytes: 262144000, // 250MB
        max_documents: 50,
        max_file_size_bytes: 10485760, // 10MB
      },
      pro: {
        max_storage_bytes: 5368709120, // 5GB
        max_documents: null, // Unlimited
        max_file_size_bytes: 52428800, // 50MB
      },
      enterprise: {
        max_storage_bytes: 26843545600, // 25GB
        max_documents: null, // Unlimited
        max_file_size_bytes: 104857600, // 100MB
      },
    };

    const limits = planLimits[settings.plan_name as keyof typeof planLimits] || planLimits.free;

    // Get current usage
    const { data: quota, error: quotaError } = await supabase
      .from('organization_storage_quotas')
      .select('*')
      .eq('org_id', org_id)
      .single();

    if (quotaError) {
      console.error('Error fetching quota:', quotaError);
      return res.status(500).json({
        error: 'Failed to fetch quota',
        details: sanitizeError(quotaError)
      });
    }

    // Calculate percentages
    const storagePercentage = limits.max_storage_bytes
      ? Math.round((quota.total_storage_bytes / limits.max_storage_bytes) * 100)
      : 0;

    const documentsPercentage = limits.max_documents
      ? Math.round((quota.total_documents / limits.max_documents) * 100)
      : 0;

    return res.status(200).json({
      current_usage: {
        total_storage_bytes: quota.total_storage_bytes,
        total_documents: quota.total_documents,
      },
      limits: {
        max_storage_bytes: limits.max_storage_bytes,
        max_documents: limits.max_documents,
        max_file_size_bytes: limits.max_file_size_bytes,
      },
      percentages: {
        storage: storagePercentage,
        documents: documentsPercentage,
      },
      plan_name: settings.plan_name,
      updated_at: quota.updated_at,
    });

  } catch (error) {
    console.error('Document quota error:', error);
    // Import sanitizeError from error-handler
    const { sanitizeError } = await import('../utils/error-handler.js');
    return res.status(500).json({
      error: sanitizeError(error, 'processing request'),
    });
  }
}
