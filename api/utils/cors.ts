import type { VercelResponse } from '@vercel/node';

/**
 * CORS Configuration Utility
 *
 * Provides secure CORS headers based on whitelisted origins from environment variables.
 * This replaces the insecure wildcard (*) CORS configuration.
 *
 * Environment Variables:
 * - ALLOWED_ORIGINS: Comma-separated list of allowed origins (e.g., "https://example.com,https://app.example.com")
 * - VITE_APP_URL: Primary application URL (used as fallback)
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'https://grantcue.com',
  'https://www.grantcue.com',
  'http://localhost:5173', // Local development
  'http://localhost:3000', // Alternative local port
];

/**
 * Get the list of allowed origins from environment variables
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;

  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }

  // Add VITE_APP_URL if it exists
  const appUrl = process.env.VITE_APP_URL;
  if (appUrl && !DEFAULT_ALLOWED_ORIGINS.includes(appUrl)) {
    return [...DEFAULT_ALLOWED_ORIGINS, appUrl];
  }

  return DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Set CORS headers on a Vercel response
 *
 * @param res - Vercel response object
 * @param origin - Request origin (from req.headers.origin)
 * @param options - CORS configuration options
 */
export function setCorsHeaders(
  res: VercelResponse,
  origin: string | undefined,
  options?: {
    credentials?: boolean;
    methods?: string;
    headers?: string;
  }
): void {
  const allowedOrigins = getAllowedOrigins();

  // Only set Access-Control-Allow-Origin if the origin is whitelisted
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // If no origin header (e.g., same-origin request), allow the first whitelisted origin
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  // If origin is not whitelisted, we don't set the header (CORS will block)

  // Set credentials support if needed
  if (options?.credentials !== false) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Set allowed methods
  res.setHeader(
    'Access-Control-Allow-Methods',
    options?.methods || 'GET, POST, PATCH, DELETE, OPTIONS'
  );

  // Set allowed headers
  res.setHeader(
    'Access-Control-Allow-Headers',
    options?.headers || 'Content-Type, Authorization'
  );
}

/**
 * Handle OPTIONS preflight requests
 *
 * @param res - Vercel response object
 * @param origin - Request origin (from req.headers.origin)
 */
export function handlePreflight(
  res: VercelResponse,
  origin: string | undefined
): void {
  setCorsHeaders(res, origin);
  res.status(200).end();
}
