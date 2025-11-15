import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Security Headers Middleware
 *
 * Applies comprehensive security headers to API responses.
 * These headers are also configured in vercel.json for all routes,
 * but this middleware provides an additional layer for API routes.
 */

export interface SecurityHeadersOptions {
  /**
   * Custom Content Security Policy directives
   * If not provided, uses sensible defaults
   */
  contentSecurityPolicy?: string;

  /**
   * Whether to include the Strict-Transport-Security header
   * Default: true
   */
  includeHSTS?: boolean;

  /**
   * Additional custom headers to apply
   */
  customHeaders?: Record<string, string>;
}

/**
 * Default Content Security Policy
 * Configured for the GrantCue application with necessary third-party services
 */
const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https://api.grants.gov https://*.supabase.co wss://*.supabase.co https://api.openai.com https://vercel.live https://vitals.vercel-insights.com",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

/**
 * Applies security headers to a Vercel API response
 *
 * @param res - Vercel response object
 * @param options - Optional configuration for security headers
 *
 * @example
 * ```typescript
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   applySecurityHeaders(res);
 *   return res.status(200).json({ message: 'Success' });
 * }
 * ```
 */
export function applySecurityHeaders(
  res: VercelResponse,
  options: SecurityHeadersOptions = {}
): void {
  const {
    contentSecurityPolicy = DEFAULT_CSP,
    includeHSTS = true,
    customHeaders = {},
  } = options;

  // X-Frame-Options: Prevents clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: Prevents MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: Controls referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy: Controls browser features and APIs
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // Content-Security-Policy: Mitigates XSS and injection attacks
  res.setHeader('Content-Security-Policy', contentSecurityPolicy);

  // Strict-Transport-Security: Enforces HTTPS
  if (includeHSTS) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  // Apply any custom headers
  Object.entries(customHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

/**
 * Middleware wrapper that applies security headers to any API handler
 *
 * @param handler - The API route handler function
 * @param options - Optional configuration for security headers
 * @returns Wrapped handler with security headers applied
 *
 * @example
 * ```typescript
 * const handler = async (req: VercelRequest, res: VercelResponse) => {
 *   return res.status(200).json({ message: 'Success' });
 * };
 *
 * export default withSecurityHeaders(handler);
 * ```
 */
export function withSecurityHeaders(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>,
  options: SecurityHeadersOptions = {}
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    applySecurityHeaders(res, options);
    return handler(req, res);
  };
}

/**
 * API-specific Content Security Policy
 * More restrictive for API endpoints that only return JSON
 */
export const API_CSP = [
  "default-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * Applies strict security headers for API-only endpoints
 *
 * @param res - Vercel response object
 *
 * @example
 * ```typescript
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   applyApiSecurityHeaders(res);
 *   return res.status(200).json({ data: [] });
 * }
 * ```
 */
export function applyApiSecurityHeaders(res: VercelResponse): void {
  applySecurityHeaders(res, {
    contentSecurityPolicy: API_CSP,
  });
}
