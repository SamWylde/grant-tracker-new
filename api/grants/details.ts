import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { opportunityId } = req.body;

    if (!opportunityId) {
      return res.status(400).json({ error: 'opportunityId is required' });
    }

    // Call Grants.gov fetchOpportunity API
    const response = await fetch('https://api.grants.gov/v1/api/fetchOpportunity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ opportunityId }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      console.error('Grants.gov fetchOpportunity error:', response.status);
      return res.status(response.status).json({
        error: 'Failed to fetch opportunity details',
      });
    }

    const data = await response.json();

    // Check for API error
    if (data.errorcode && data.errorcode !== 0) {
      console.error('Grants.gov API error:', data.msg);
      return res.status(502).json({
        error: data.msg || 'Error fetching opportunity details',
      });
    }

    // Return the full opportunity data
    return res.status(200).json(data.data || data);
  } catch (error) {
    console.error('Error fetching opportunity:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
