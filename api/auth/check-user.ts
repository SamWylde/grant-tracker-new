import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Use admin API to list users by email
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error checking user:', error);
      return res.status(500).json({ error: 'Failed to check user' });
    }

    // Check if user with this email exists
    const userExists = users?.some(user => user.email?.toLowerCase() === email.toLowerCase());

    return res.status(200).json({
      exists: userExists,
      message: userExists ? 'User found' : 'User not found'
    });
  } catch (error) {
    console.error('Error in check-user API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
