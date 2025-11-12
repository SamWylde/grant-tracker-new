import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Fetch and extract text from a PDF URL
 * This is a server-side endpoint to avoid CORS issues
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { pdf_url, opportunityId } = req.body;

    if (!pdf_url && !opportunityId) {
      return res.status(400).json({ error: 'Either pdf_url or opportunityId is required' });
    }

    let urlToFetch = pdf_url;

    // If opportunityId provided, try common Grants.gov NOFO URL patterns
    if (!urlToFetch && opportunityId) {
      // Try common Grants.gov NOFO document patterns
      const possibleUrls = [
        `https://www.grants.gov/web/grants/view-opportunity.html?oppId=${opportunityId}`,
        `https://www.grants.gov/search-results-detail/${opportunityId}`,
      ];

      console.log(`[PDF Fetch] Attempting to find NOFO for opportunity ${opportunityId}`);

      // For now, we'll return an error since Grants.gov doesn't have a direct PDF API
      // The actual PDF URLs are dynamic and require scraping their website
      return res.status(400).json({
        error: 'Direct PDF fetch from Grants.gov not yet implemented',
        message: 'Please provide a direct PDF URL or upload a PDF file',
        grant_page_url: possibleUrls[1],
      });
    }

    // Validate URL
    if (!urlToFetch.startsWith('http://') && !urlToFetch.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid PDF URL' });
    }

    console.log(`[PDF Fetch] Fetching PDF from: ${urlToFetch}`);

    // Fetch the PDF
    const pdfResponse = await fetch(urlToFetch, {
      headers: {
        'User-Agent': 'GrantCue-NOFO-Analyzer/1.0',
      },
    });

    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    // Check content type
    const contentType = pdfResponse.headers.get('content-type');
    if (!contentType?.includes('pdf')) {
      throw new Error(`URL does not point to a PDF file. Content-Type: ${contentType}`);
    }

    // Get PDF as array buffer
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfSize = pdfBuffer.byteLength;

    console.log(`[PDF Fetch] Downloaded PDF: ${pdfSize} bytes`);

    // For now, we'll use pdf-parse on the server side
    // Note: This requires installing pdf-parse package
    // For the initial implementation, we'll return the buffer info
    // and let the client handle extraction

    return res.status(200).json({
      success: true,
      pdf_size: pdfSize,
      pdf_url: urlToFetch,
      message: 'PDF fetched successfully. Text extraction should be done client-side for now.',
      // In production, we'd extract text here using pdf-parse
    });
  } catch (error) {
    console.error('Error fetching PDF:', error);
    return res.status(500).json({
      error: 'Failed to fetch PDF',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
