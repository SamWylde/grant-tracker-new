import { timingSafeEqual } from 'crypto';

/**
 * Authentication Utilities
 *
 * Provides secure authentication helpers including timing-safe comparison
 * to prevent timing attacks on secret validation.
 */

/**
 * Verify CRON request authentication using timing-safe comparison
 *
 * This prevents timing attacks where an attacker could measure the time
 * it takes to compare strings and deduce the secret character by character.
 *
 * SECURITY NOTE: The CRON_SECRET should be:
 * - At least 32 characters long
 * - Cryptographically random (use a secure random generator)
 * - Rotated regularly (e.g., every 90 days)
 * - Stored securely in environment variables
 * - Never committed to version control
 *
 * @param authHeader - Authorization header from the request
 * @returns true if the CRON secret is valid, false otherwise
 */
export function verifyCronAuth(authHeader: string | undefined): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[Auth] CRON_SECRET is not configured');
    return false;
  }

  if (!authHeader) {
    return false;
  }

  const expectedAuth = `Bearer ${cronSecret}`;

  // Both strings must be the same length for timingSafeEqual
  if (authHeader.length !== expectedAuth.length) {
    return false;
  }

  try {
    // Convert strings to buffers for timing-safe comparison
    const authBuffer = Buffer.from(authHeader, 'utf-8');
    const expectedBuffer = Buffer.from(expectedAuth, 'utf-8');

    return timingSafeEqual(authBuffer, expectedBuffer);
  } catch (error) {
    // This can happen if the strings have different lengths
    // (though we check above, being extra safe)
    console.error('[Auth] Error in timing-safe comparison:', error);
    return false;
  }
}

/**
 * Check if a request is authenticated (either user or CRON)
 *
 * @param authHeader - Authorization header from the request
 * @returns Object indicating the authentication type
 */
export function checkAuth(authHeader: string | undefined): {
  isCron: boolean;
  isUser: boolean;
  token: string | null;
} {
  if (!authHeader) {
    return { isCron: false, isUser: false, token: null };
  }

  // Check if it's a CRON request
  if (verifyCronAuth(authHeader)) {
    return { isCron: true, isUser: false, token: null };
  }

  // Check if it's a user request with Bearer token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return { isCron: false, isUser: true, token };
  }

  return { isCron: false, isUser: false, token: null };
}
