/**
 * Rate Limiting Utility
 *
 * Implements rate limiting using Upstash Redis to protect API endpoints
 * from abuse and ensure fair usage across all users.
 *
 * Configuration:
 * - UPSTASH_REDIS_REST_URL: Redis REST URL from Upstash dashboard
 * - UPSTASH_REDIS_REST_TOKEN: Redis REST token from Upstash dashboard
 *
 * Rate Limit Tiers:
 * - PUBLIC: 100 requests/minute per IP (search, check-user endpoints)
 * - AUTH: 10 requests/minute per IP (login, signup, password reset)
 * - STANDARD: 60 requests/minute per IP (general authenticated endpoints)
 * - ADMIN: 30 requests/minute per IP (admin operations)
 *
 * Usage:
 * ```typescript
 * import { rateLimitPublic, rateLimitAuth } from './utils/ratelimit';
 *
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   const rateLimitResult = await rateLimitPublic(req);
 *   if (!rateLimitResult.success) {
 *     return res.status(429).json({
 *       error: 'Too many requests',
 *       retryAfter: rateLimitResult.retryAfter
 *     });
 *   }
 *   // ... rest of your handler
 * }
 * ```
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client (singleton pattern)
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) {
    return redis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Rate limiting is optional - if not configured, we'll skip it
  // This allows the app to run without Upstash in development
  if (!url || !token) {
    console.warn('[RateLimit] Upstash Redis not configured - rate limiting disabled');
    return null;
  }

  try {
    redis = new Redis({
      url,
      token,
    });
    console.log('[RateLimit] Upstash Redis client initialized');
    return redis;
  } catch (error) {
    console.error('[RateLimit] Failed to initialize Redis client:', error);
    return null;
  }
}

// Rate limiter instances (lazy initialization)
let publicLimiter: Ratelimit | null = null;
let authLimiter: Ratelimit | null = null;
let standardLimiter: Ratelimit | null = null;
let adminLimiter: Ratelimit | null = null;

/**
 * Get or create the public rate limiter (100 req/min)
 * Used for: grants/search, auth/check-user
 */
function getPublicLimiter(): Ratelimit | null {
  if (publicLimiter) {
    return publicLimiter;
  }

  const client = getRedisClient();
  if (!client) {
    return null;
  }

  publicLimiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
    analytics: true,
    prefix: 'ratelimit:public',
  });

  return publicLimiter;
}

/**
 * Get or create the auth rate limiter (10 req/min)
 * Used for: auth/login, auth/signup, auth/reset-password
 */
function getAuthLimiter(): Ratelimit | null {
  if (authLimiter) {
    return authLimiter;
  }

  const client = getRedisClient();
  if (!client) {
    return null;
  }

  authLimiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
    analytics: true,
    prefix: 'ratelimit:auth',
  });

  return authLimiter;
}

/**
 * Get or create the standard rate limiter (60 req/min)
 * Used for: most authenticated endpoints
 */
function getStandardLimiter(): Ratelimit | null {
  if (standardLimiter) {
    return standardLimiter;
  }

  const client = getRedisClient();
  if (!client) {
    return null;
  }

  standardLimiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 requests per minute
    analytics: true,
    prefix: 'ratelimit:standard',
  });

  return standardLimiter;
}

/**
 * Get or create the admin rate limiter (30 req/min)
 * Used for: admin operations (sync, user management)
 */
function getAdminLimiter(): Ratelimit | null {
  if (adminLimiter) {
    return adminLimiter;
  }

  const client = getRedisClient();
  if (!client) {
    return null;
  }

  adminLimiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
    analytics: true,
    prefix: 'ratelimit:admin',
  });

  return adminLimiter;
}

/**
 * Extract identifier from request (IP address or user ID)
 */
function getIdentifier(req: VercelRequest): string {
  // Try to get the real IP address from various headers
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];

  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, take the first one
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    return ip;
  }

  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }

  // Fallback to connection remote address (less reliable in serverless)
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Rate limit result interface
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Apply rate limiting and return result
 */
async function applyRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  // If limiter is not configured, allow the request
  if (!limiter) {
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    };
  }

  try {
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // On error, allow the request (fail open)
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    };
  }
}

/**
 * Rate limit middleware for public endpoints (100 req/min)
 * Use for: grants/search, auth/check-user
 */
export async function rateLimitPublic(req: VercelRequest): Promise<RateLimitResult> {
  const limiter = getPublicLimiter();
  const identifier = getIdentifier(req);
  return applyRateLimit(limiter, identifier);
}

/**
 * Rate limit middleware for auth endpoints (10 req/min)
 * Use for: auth/login, auth/signup, auth/reset-password
 */
export async function rateLimitAuth(req: VercelRequest): Promise<RateLimitResult> {
  const limiter = getAuthLimiter();
  const identifier = getIdentifier(req);
  return applyRateLimit(limiter, identifier);
}

/**
 * Rate limit middleware for standard endpoints (60 req/min)
 * Use for: most authenticated endpoints
 */
export async function rateLimitStandard(req: VercelRequest): Promise<RateLimitResult> {
  const limiter = getStandardLimiter();
  const identifier = getIdentifier(req);
  return applyRateLimit(limiter, identifier);
}

/**
 * Rate limit middleware for admin endpoints (30 req/min)
 * Use for: admin operations
 */
export async function rateLimitAdmin(req: VercelRequest): Promise<RateLimitResult> {
  const limiter = getAdminLimiter();
  const identifier = getIdentifier(req);
  return applyRateLimit(limiter, identifier);
}

/**
 * Helper function to set rate limit headers on response
 */
export function setRateLimitHeaders(res: VercelResponse, result: RateLimitResult): void {
  res.setHeader('X-RateLimit-Limit', result.limit.toString());
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', result.reset.toString());

  if (result.retryAfter) {
    res.setHeader('Retry-After', result.retryAfter.toString());
  }
}

/**
 * Helper function to handle rate limit response
 * Returns true if rate limit exceeded (handler should return)
 */
export function handleRateLimit(
  res: VercelResponse,
  result: RateLimitResult
): boolean {
  setRateLimitHeaders(res, result);

  if (!result.success) {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: result.retryAfter,
    });
    return true;
  }

  return false;
}
