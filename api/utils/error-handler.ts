import type { VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  details?: string | Record<string, any>;
  timestamp: string;
  requestId: string;
  statusCode?: number;
  stack?: string; // Only included in development
}

/**
 * Error types for better categorization
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  TIMEOUT = 'REQUEST_TIMEOUT',
  EXTERNAL_API = 'EXTERNAL_API_ERROR',
  DATABASE = 'DATABASE_ERROR',
  SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

/**
 * Error configuration
 */
interface ErrorConfig {
  message: string;
  details?: string | Record<string, any>;
  statusCode?: number;
  type?: ErrorType;
  originalError?: Error | unknown;
  requestId?: string;
}

/**
 * Generate a unique request ID for tracking
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Determine if we're in production environment
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

/**
 * Get status code based on error type
 */
function getStatusCodeForErrorType(type: ErrorType): number {
  const statusCodes: Record<ErrorType, number> = {
    [ErrorType.VALIDATION]: 400,
    [ErrorType.AUTHENTICATION]: 401,
    [ErrorType.AUTHORIZATION]: 403,
    [ErrorType.NOT_FOUND]: 404,
    [ErrorType.CONFLICT]: 409,
    [ErrorType.RATE_LIMIT]: 429,
    [ErrorType.QUOTA_EXCEEDED]: 413,
    [ErrorType.TIMEOUT]: 504,
    [ErrorType.EXTERNAL_API]: 502,
    [ErrorType.DATABASE]: 500,
    [ErrorType.SERVER_ERROR]: 500,
  };
  return statusCodes[type] || 500;
}

/**
 * Format error for logging (includes full details and stack trace)
 */
function formatErrorForLogging(config: ErrorConfig): Record<string, any> {
  const logData: Record<string, any> = {
    timestamp: new Date().toISOString(),
    requestId: config.requestId || generateRequestId(),
    type: config.type || ErrorType.SERVER_ERROR,
    message: config.message,
    statusCode: config.statusCode || getStatusCodeForErrorType(config.type || ErrorType.SERVER_ERROR),
  };

  if (config.details) {
    logData.details = config.details;
  }

  if (config.originalError) {
    if (config.originalError instanceof Error) {
      logData.originalError = {
        name: config.originalError.name,
        message: config.originalError.message,
        stack: config.originalError.stack,
      };
    } else {
      logData.originalError = config.originalError;
    }
  }

  return logData;
}

/**
 * Create a standardized error response object
 */
export function createErrorResponse(config: ErrorConfig): ErrorResponse {
  const requestId = config.requestId || generateRequestId();
  const statusCode = config.statusCode || getStatusCodeForErrorType(config.type || ErrorType.SERVER_ERROR);

  const errorResponse: ErrorResponse = {
    error: config.message,
    timestamp: new Date().toISOString(),
    requestId,
    statusCode,
  };

  // Add details if provided
  if (config.details) {
    errorResponse.details = config.details;
  }

  // Only include stack trace in development
  if (!isProduction() && config.originalError instanceof Error) {
    errorResponse.stack = config.originalError.stack;
  }

  return errorResponse;
}

/**
 * Send a standardized error response and log it
 */
export function sendErrorResponse(
  res: VercelResponse,
  config: ErrorConfig
): void {
  const requestId = config.requestId || generateRequestId();
  const statusCode = config.statusCode || getStatusCodeForErrorType(config.type || ErrorType.SERVER_ERROR);

  // Log error with full details
  const logData = formatErrorForLogging({ ...config, requestId });
  console.error('API Error:', JSON.stringify(logData, null, 2));

  // Create response (sanitized for production)
  const errorResponse = createErrorResponse({ ...config, requestId });

  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * Quick error response helpers for common scenarios
 */
export const ErrorHandlers = {
  /**
   * 400 - Validation Error
   */
  validation(res: VercelResponse, message: string, details?: string | Record<string, any>, requestId?: string): void {
    sendErrorResponse(res, {
      message,
      details,
      type: ErrorType.VALIDATION,
      requestId,
    });
  },

  /**
   * 401 - Authentication Error
   */
  unauthorized(res: VercelResponse, message = 'Unauthorized', details?: string, requestId?: string): void {
    sendErrorResponse(res, {
      message,
      details,
      type: ErrorType.AUTHENTICATION,
      requestId,
    });
  },

  /**
   * 403 - Authorization/Forbidden Error
   */
  forbidden(res: VercelResponse, message = 'Access denied', details?: string, requestId?: string): void {
    sendErrorResponse(res, {
      message,
      details,
      type: ErrorType.AUTHORIZATION,
      requestId,
    });
  },

  /**
   * 404 - Not Found Error
   */
  notFound(res: VercelResponse, resource: string, requestId?: string): void {
    sendErrorResponse(res, {
      message: `${resource} not found`,
      type: ErrorType.NOT_FOUND,
      requestId,
    });
  },

  /**
   * 405 - Method Not Allowed
   */
  methodNotAllowed(res: VercelResponse, allowedMethods: string[], requestId?: string): void {
    sendErrorResponse(res, {
      message: 'Method not allowed',
      details: `Allowed methods: ${allowedMethods.join(', ')}`,
      statusCode: 405,
      requestId,
    });
  },

  /**
   * 409 - Conflict Error
   */
  conflict(res: VercelResponse, message: string, details?: string | Record<string, any>, requestId?: string): void {
    sendErrorResponse(res, {
      message,
      details,
      type: ErrorType.CONFLICT,
      requestId,
    });
  },

  /**
   * 413 - Quota Exceeded
   */
  quotaExceeded(res: VercelResponse, message = 'Quota exceeded', details?: string | Record<string, any>, requestId?: string): void {
    sendErrorResponse(res, {
      message,
      details,
      type: ErrorType.QUOTA_EXCEEDED,
      requestId,
    });
  },

  /**
   * 429 - Rate Limit Exceeded
   */
  rateLimit(res: VercelResponse, retryAfter?: number, requestId?: string): void {
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter.toString());
    }
    sendErrorResponse(res, {
      message: 'Rate limit exceeded',
      details: retryAfter ? `Please retry after ${retryAfter} seconds` : undefined,
      type: ErrorType.RATE_LIMIT,
      requestId,
    });
  },

  /**
   * 500 - Internal Server Error
   */
  serverError(res: VercelResponse, error?: Error | unknown, requestId?: string): void {
    const message = error instanceof Error ? error.message : 'Internal server error';
    sendErrorResponse(res, {
      message: isProduction() ? 'Internal server error' : message,
      type: ErrorType.SERVER_ERROR,
      originalError: error,
      requestId,
    });
  },

  /**
   * 502 - External API Error
   */
  externalApi(res: VercelResponse, service: string, error?: Error | unknown, requestId?: string): void {
    sendErrorResponse(res, {
      message: `Failed to communicate with ${service}`,
      details: error instanceof Error && !isProduction() ? error.message : undefined,
      type: ErrorType.EXTERNAL_API,
      originalError: error,
      requestId,
    });
  },

  /**
   * 504 - Timeout Error
   */
  timeout(res: VercelResponse, message = 'Request timeout', requestId?: string): void {
    sendErrorResponse(res, {
      message,
      type: ErrorType.TIMEOUT,
      requestId,
    });
  },

  /**
   * Database Error
   */
  database(res: VercelResponse, error?: Error | unknown, requestId?: string): void {
    sendErrorResponse(res, {
      message: isProduction() ? 'Database error' : 'Database operation failed',
      details: error instanceof Error && !isProduction() ? error.message : undefined,
      type: ErrorType.DATABASE,
      originalError: error,
      requestId,
    });
  },
};

/**
 * Wrapper function to handle errors in async handlers
 * Usage: export default wrapHandler(async (req, res) => { ... });
 */
export function wrapHandler(
  handler: (req: any, res: VercelResponse) => Promise<void | VercelResponse>
) {
  return async (req: any, res: VercelResponse) => {
    const requestId = generateRequestId();

    try {
      await handler(req, res);
    } catch (error) {
      // If headers already sent, can't send error response
      if (res.headersSent) {
        console.error('Error after headers sent:', error);
        return;
      }

      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          ErrorHandlers.timeout(res, 'Request timeout - please try again', requestId);
          return;
        }
      }

      // Generic server error
      ErrorHandlers.serverError(res, error, requestId);
    }
  };
}

/**
 * Parse and categorize common errors from Supabase or other services
 */
export function categorizeError(error: any): { type: ErrorType; message: string; details?: string } {
  if (!error) {
    return {
      type: ErrorType.SERVER_ERROR,
      message: 'Unknown error',
    };
  }

  const errorMessage = error.message || error.toString();

  // Authentication errors
  if (errorMessage.includes('JWT') || errorMessage.includes('token') || errorMessage.includes('auth')) {
    return {
      type: ErrorType.AUTHENTICATION,
      message: 'Authentication failed',
      details: errorMessage,
    };
  }

  // Authorization errors
  if (errorMessage.includes('permission') || errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
    return {
      type: ErrorType.AUTHORIZATION,
      message: 'Access denied',
      details: errorMessage,
    };
  }

  // Not found errors
  if (errorMessage.includes('not found') || error.code === 'PGRST116') {
    return {
      type: ErrorType.NOT_FOUND,
      message: 'Resource not found',
      details: errorMessage,
    };
  }

  // Validation errors
  if (errorMessage.includes('invalid') || errorMessage.includes('validation') || error.code?.startsWith('23')) {
    return {
      type: ErrorType.VALIDATION,
      message: 'Validation error',
      details: errorMessage,
    };
  }

  // Quota errors
  if (errorMessage.includes('quota') || errorMessage.includes('limit exceeded')) {
    return {
      type: ErrorType.QUOTA_EXCEEDED,
      message: 'Quota exceeded',
      details: errorMessage,
    };
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || error.name === 'AbortError') {
    return {
      type: ErrorType.TIMEOUT,
      message: 'Request timeout',
      details: errorMessage,
    };
  }

  // Default to server error
  return {
    type: ErrorType.SERVER_ERROR,
    message: 'Internal server error',
    details: errorMessage,
  };
}

/**
 * Sanitize error for client response
 *
 * SECURITY: This function prevents information disclosure by:
 * - Removing database column names and constraint details
 * - Removing stack traces
 * - Removing internal file paths and system information
 * - Logging full error details server-side for debugging
 * - Returning only safe, generic messages to clients
 *
 * @param error - The error to sanitize
 * @param context - Optional context for logging (e.g., 'creating user', 'fetching grants')
 * @returns Sanitized error message safe for client
 */
export function sanitizeError(error: any, context?: string): string {
  // Log full error details server-side for debugging
  const logPrefix = context ? `[${context}]` : '[Error]';
  console.error(`${logPrefix} Full error details:`, error);

  // If error is not an object, return generic message
  if (!error) {
    return 'An unexpected error occurred';
  }

  const errorMessage = error.message || error.toString?.() || '';
  const errorCode = error.code || '';

  // Handle specific database error codes with safe messages
  // These are PostgreSQL/Supabase error codes
  if (errorCode === '23505') {
    return 'This item already exists';
  }
  if (errorCode === '23503') {
    return 'Cannot perform operation due to existing dependencies';
  }
  if (errorCode === '23502') {
    return 'Required field is missing';
  }
  if (errorCode === '23514') {
    return 'Invalid data provided';
  }
  if (errorCode === '42501') {
    return 'Insufficient permissions';
  }
  if (errorCode === 'PGRST116') {
    return 'Resource not found';
  }

  // Check for common error patterns and return safe messages
  if (errorMessage.includes('JWT') || errorMessage.includes('token')) {
    return 'Authentication failed';
  }
  if (errorMessage.includes('quota') || errorMessage.includes('limit exceeded') || errorMessage.includes('storage')) {
    return 'Storage quota exceeded';
  }
  if (errorMessage.includes('timeout') || error.name === 'AbortError') {
    return 'Request timeout - please try again';
  }
  if (errorMessage.includes('network') || errorMessage.includes('fetch failed')) {
    return 'Network error - please check your connection';
  }
  if (errorMessage.includes('rate limit')) {
    return 'Too many requests - please try again later';
  }

  // In production, never expose internal error messages
  if (isProduction()) {
    return 'An error occurred while processing your request';
  }

  // In development, return a sanitized version of the error
  // Remove potentially sensitive patterns
  let sanitized = errorMessage;

  // Remove database column references (e.g., column "user_id")
  sanitized = sanitized.replace(/column "[\w_]+"/g, 'field');
  sanitized = sanitized.replace(/relation "[\w_]+"/g, 'table');
  sanitized = sanitized.replace(/constraint "[\w_]+"/g, 'constraint');

  // Remove file paths
  sanitized = sanitized.replace(/\/[\w\/\-\.]+\.(ts|js|tsx|jsx)/g, '[file]');
  sanitized = sanitized.replace(/at [\w\.]+ \([^\)]+\)/g, '');

  // Remove stack trace references
  sanitized = sanitized.replace(/\s+at\s+.*/g, '');

  // Truncate if still too long
  if (sanitized.length > 150) {
    sanitized = sanitized.substring(0, 150) + '...';
  }

  return sanitized || 'An error occurred while processing your request';
}

/**
 * Check if a database error is a known, safe-to-expose type
 * These errors can show user-friendly messages without exposing internals
 */
export function isDatabaseConstraintError(error: any): boolean {
  const code = error?.code || '';
  // PostgreSQL constraint violation codes
  return ['23505', '23503', '23502', '23514'].includes(code);
}
