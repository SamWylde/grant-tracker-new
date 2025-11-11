import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize Supabase client
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Extract orgId and token from URL
    const { orgId, token } = req.query;

    if (!orgId || typeof orgId !== 'string' || !token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Remove .ics extension from token if present
    const cleanToken = token.replace(/\.ics$/, '');

    // Verify the token matches the organization's ICS token
    const { data: orgSettings, error: orgError } = await supabase
      .from('organization_settings')
      .select('ics_token')
      .eq('org_id', orgId)
      .single();

    if (orgError || !orgSettings || orgSettings.ics_token !== cleanToken) {
      return res.status(404).json({ error: 'Calendar feed not found' });
    }

    // Fetch all grants for this organization with close dates
    const { data: grants, error: grantsError } = await supabase
      .from('org_grants_saved')
      .select('id, title, agency, close_date, external_id, description')
      .eq('org_id', orgId)
      .not('close_date', 'is', null)
      .order('close_date', { ascending: true });

    if (grantsError) {
      console.error('Error fetching grants:', grantsError);
      // Return empty calendar instead of error
    }

    // Generate ICS file (even if empty)
    const icsLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GrantCue//Grant Deadline Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Grant Deadlines',
      'X-WR-TIMEZONE:UTC',
      'X-WR-CALDESC:Grant deadlines from GrantCue',
    ];

    // Add events for each grant (if any)
    for (const grant of grants || []) {
      if (!grant.close_date) continue;

      const closeDate = new Date(grant.close_date);
      const uid = `grant-${grant.id}@grantcue.com`;

      // Format date as YYYYMMDD for all-day event
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      const dtstart = formatDate(closeDate);
      const now = new Date();
      const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      // Clean and truncate description
      const description = grant.description
        ? grant.description.replace(/\n/g, '\\n').replace(/,/g, '\\,').substring(0, 500)
        : 'Grant deadline';

      const grantsGovUrl = `https://www.grants.gov/search-results-detail/${grant.external_id}`;

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `SUMMARY:Grant Deadline: ${grant.title.replace(/,/g, '\\,')}`,
        `DESCRIPTION:${description}\\n\\nAgency: ${(grant.agency || 'N/A').replace(/,/g, '\\,')}\\n\\nView details: ${grantsGovUrl}`,
        `URL:${grantsGovUrl}`,
        'STATUS:CONFIRMED',
        'TRANSP:TRANSPARENT',
        'END:VEVENT'
      );
    }

    icsLines.push('END:VCALENDAR');

    const icsContent = icsLines.join('\r\n');

    // Set headers for ICS file
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="grant-deadlines.ics"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(icsContent);
  } catch (error) {
    console.error('Error generating ICS feed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
