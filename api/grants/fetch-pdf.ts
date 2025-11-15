import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { fetchWithTimeout, TimeoutPresets, isTimeoutError } from '../utils/timeout';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// SSRF Protection: Allowlist of permitted domains
const ALLOWED_DOMAINS = [
  'grants.gov',
  'www.grants.gov',
  'sam.gov',
  'www.sam.gov',
];

// SSRF Protection: Private IP ranges to block
const PRIVATE_IP_RANGES = [
  /^10\./,                          // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
  /^192\.168\./,                     // 192.168.0.0/16
  /^127\./,                          // 127.0.0.0/8 (localhost)
  /^169\.254\./,                     // 169.254.0.0/16 (link-local)
  /^0\./,                            // 0.0.0.0/8
  /^224\./,                          // 224.0.0.0/4 (multicast)
  /^240\./,                          // 240.0.0.0/4 (reserved)
];

/**
 * Validates URL for SSRF protection
 * @param url - The URL to validate
 * @returns An object with isValid boolean and optional error message
 */
function validateUrlForSSRF(url: string): { isValid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);

    // 1. Only allow HTTPS protocol
    if (parsedUrl.protocol !== 'https:') {
      return { isValid: false, error: 'Only HTTPS URLs are allowed' };
    }

    // 2. Check domain allowlist
    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowedDomain) {
      return {
        isValid: false,
        error: `Domain not allowed. Only grants.gov and sam.gov domains are permitted`
      };
    }

    // 3. Block private IP addresses (if hostname is an IP)
    const ipMatch = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
    if (ipMatch) {
      for (const range of PRIVATE_IP_RANGES) {
        if (range.test(hostname)) {
          return { isValid: false, error: 'Private IP addresses are not allowed' };
        }
      }
    }

    // 4. Block localhost variations
    if (hostname === 'localhost' || hostname === '[::1]' || hostname.startsWith('127.')) {
      return { isValid: false, error: 'Localhost addresses are not allowed' };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

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

    // SSRF Protection: Validate URL before fetching
    const validation = validateUrlForSSRF(urlToFetch);
    if (!validation.isValid) {
      console.error(`[PDF Fetch] SSRF validation failed: ${validation.error}`);
      return res.status(400).json({
        error: 'Invalid PDF URL',
        message: validation.error
      });
    }

    console.log(`[PDF Fetch] Fetching PDF from: ${urlToFetch}`);

    // Fetch the PDF with timeout protection
    try {
      const pdfResponse = await fetchWithTimeout(urlToFetch, {
        headers: {
          'User-Agent': 'GrantCue-NOFO-Analyzer/1.0',
        },
        timeoutMs: TimeoutPresets.PDF_FETCH, // 30 seconds
        retry: true,
        maxRetries: 2,
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
    } catch (fetchError) {
      // Handle timeout errors specifically
      if (isTimeoutError(fetchError)) {
        console.error('[PDF Fetch] Request timeout');
        return res.status(408).json({
          error: 'Request timeout',
          message: 'PDF fetch request timed out. The PDF may be too large or the server is slow to respond.'
        });
      }

      throw fetchError;
    }
  } catch (error) {
    console.error('Error fetching PDF:', error);
    return res.status(500).json({
      error: 'Failed to fetch PDF',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
