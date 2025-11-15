/**
 * Structured Logging Utility
 *
 * Provides a standardized logging interface for the Grant Tracker application.
 * Logs are output in JSON format in production for easier parsing and analysis,
 * and in a human-readable format in development for easier debugging.
 *
 * USAGE EXAMPLES:
 *
 * Basic logging:
 * ```typescript
 * import { logInfo, logError, logWarn, logDebug } from './utils/logger';
 *
 * logInfo('User logged in successfully');
 * logError('Failed to fetch grants', error);
 * logWarn('Rate limit approaching', { remaining: 5 });
 * logDebug('Processing search request', { keyword: 'education' });
 * ```
 *
 * With context:
 * ```typescript
 * logInfo('Grant created', {
 *   grantId: 'abc123',
 *   userId: 'user456',
 *   orgId: 'org789'
 * });
 *
 * logError('Database query failed', error, {
 *   table: 'grants',
 *   operation: 'insert'
 * });
 * ```
 *
 * LOG LEVELS:
 *
 * - DEBUG: Detailed diagnostic information for development/troubleshooting
 *   Use for: Function entry/exit, variable values, detailed flow tracking
 *   Example: "Processing 10 grants from search results"
 *
 * - INFO: General informational messages about application operations
 *   Use for: Successful operations, state changes, important milestones
 *   Example: "User authentication successful", "Grant saved to database"
 *
 * - WARN: Warning messages for potentially harmful situations
 *   Use for: Deprecated features, rate limit warnings, fallback behavior
 *   Example: "API response missing optional field", "Cache miss, fetching from source"
 *
 * - ERROR: Error messages for failures and exceptions
 *   Use for: Failed operations, caught exceptions, validation errors
 *   Example: "Failed to connect to database", "Invalid API response"
 *
 * CONTEXT FIELDS:
 *
 * The logger automatically includes these fields in every log entry:
 * - timestamp: ISO 8601 timestamp
 * - level: Log level (DEBUG, INFO, WARN, ERROR)
 * - message: The log message
 *
 * You can optionally provide additional context:
 * - requestId: Unique identifier for the request (from X-Request-ID header)
 * - userId: ID of the authenticated user
 * - orgId: ID of the user's organization
 * - endpoint: API endpoint being called
 * - method: HTTP method
 * - ...any other relevant fields
 *
 * PRODUCTION vs DEVELOPMENT:
 *
 * In production (NODE_ENV === 'production'):
 * - Logs are output as JSON for structured parsing
 * - Includes all context fields
 * - Easy to ingest into log aggregation services
 *
 * In development:
 * - Logs are output in human-readable format
 * - Includes colored output for easy scanning
 * - Shows full stack traces for errors
 */

import type { VercelRequest } from '@vercel/node';

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// Log entry structure
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  orgId?: string;
  endpoint?: string;
  method?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: any; // Allow additional context fields
}

// Environment detection
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Core logging function that outputs structured logs
 */
function log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error | unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  // Add error details if provided
  if (error) {
    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else {
      entry.error = {
        name: 'UnknownError',
        message: String(error),
      };
    }
  }

  if (isDevelopment) {
    // Human-readable format for development
    formatDevelopmentLog(entry);
  } else {
    // JSON format for production
    console.log(JSON.stringify(entry));
  }
}

/**
 * Format logs for development environment with colors and readable structure
 */
function formatDevelopmentLog(entry: LogEntry): void {
  // ANSI color codes
  const colors = {
    DEBUG: '\x1b[36m',   // Cyan
    INFO: '\x1b[32m',    // Green
    WARN: '\x1b[33m',    // Yellow
    ERROR: '\x1b[31m',   // Red
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m',
    DIM: '\x1b[2m',
  };

  const levelColor = colors[entry.level] || colors.RESET;
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();

  // Build the log line
  let logLine = `${colors.DIM}[${timestamp}]${colors.RESET} ${levelColor}${colors.BOLD}${entry.level}${colors.RESET} ${entry.message}`;

  // Add context fields (excluding standard fields)
  const { timestamp: _, level: __, message: ___, error: ____, ...contextFields } = entry;
  if (Object.keys(contextFields).length > 0) {
    logLine += `\n  ${colors.DIM}Context: ${JSON.stringify(contextFields, null, 2)}${colors.RESET}`;
  }

  // Add error details if present
  if (entry.error) {
    logLine += `\n  ${colors.ERROR}Error: ${entry.error.name}: ${entry.error.message}${colors.RESET}`;
    if (entry.error.stack) {
      logLine += `\n${colors.DIM}${entry.error.stack}${colors.RESET}`;
    }
  }

  console.log(logLine);
}

/**
 * Extract common context from Vercel request
 */
export function extractRequestContext(req: VercelRequest): Record<string, any> {
  return {
    requestId: req.headers['x-request-id'] || req.headers['x-vercel-id'],
    endpoint: req.url,
    method: req.method,
    ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'],
  };
}

// ============================================================================
// Public API - Use these functions throughout the application
// ============================================================================

/**
 * Log an informational message
 *
 * Use for: Successful operations, state changes, important milestones
 *
 * @param message - The log message
 * @param context - Optional context object with additional fields
 *
 * @example
 * logInfo('User authenticated successfully', { userId: '123', method: 'oauth' });
 */
export function logInfo(message: string, context?: Record<string, any>): void {
  log(LogLevel.INFO, message, context);
}

/**
 * Log a warning message
 *
 * Use for: Potentially harmful situations, deprecation warnings, fallbacks
 *
 * @param message - The log message
 * @param context - Optional context object with additional fields
 *
 * @example
 * logWarn('API rate limit approaching', { remaining: 5, limit: 100 });
 */
export function logWarn(message: string, context?: Record<string, any>): void {
  log(LogLevel.WARN, message, context);
}

/**
 * Log an error message
 *
 * Use for: Failed operations, caught exceptions, validation errors
 *
 * @param message - The log message
 * @param error - Optional Error object (will extract name, message, stack)
 * @param context - Optional context object with additional fields
 *
 * @example
 * logError('Failed to fetch grants from database', error, { table: 'grants' });
 */
export function logError(message: string, error?: Error | unknown, context?: Record<string, any>): void {
  log(LogLevel.ERROR, message, context, error);
}

/**
 * Log a debug message
 *
 * Use for: Detailed diagnostic information, development troubleshooting
 *
 * @param message - The log message
 * @param context - Optional context object with additional fields
 *
 * @example
 * logDebug('Processing search request', { keyword: 'education', filters: 3 });
 */
export function logDebug(message: string, context?: Record<string, any>): void {
  log(LogLevel.DEBUG, message, context);
}

/**
 * Create a scoped logger for a specific module/endpoint
 *
 * This creates a logger that automatically includes context for all log calls.
 * Useful for maintaining consistent context throughout a module.
 *
 * @param scopeContext - Context to include in all logs from this logger
 *
 * @example
 * const logger = createLogger({ endpoint: '/api/grants/search', module: 'search' });
 * logger.info('Starting search', { keyword: 'education' });
 * logger.error('Search failed', error);
 */
export function createLogger(scopeContext: Record<string, any>) {
  return {
    info: (message: string, context?: Record<string, any>) =>
      logInfo(message, { ...scopeContext, ...context }),
    warn: (message: string, context?: Record<string, any>) =>
      logWarn(message, { ...scopeContext, ...context }),
    error: (message: string, error?: Error | unknown, context?: Record<string, any>) =>
      logError(message, error, { ...scopeContext, ...context }),
    debug: (message: string, context?: Record<string, any>) =>
      logDebug(message, { ...scopeContext, ...context }),
  };
}

/**
 * Create a logger with request context automatically included
 *
 * @param req - Vercel request object
 * @param additionalContext - Additional context to include
 *
 * @example
 * const logger = createRequestLogger(req, { userId: user.id, orgId: user.orgId });
 * logger.info('Processing request');
 * logger.error('Request failed', error);
 */
export function createRequestLogger(req: VercelRequest, additionalContext?: Record<string, any>) {
  const requestContext = extractRequestContext(req);
  return createLogger({ ...requestContext, ...additionalContext });
}

// Export the logger class for advanced usage
export class Logger {
  private context: Record<string, any>;

  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }

  info(message: string, context?: Record<string, any>): void {
    logInfo(message, { ...this.context, ...context });
  }

  warn(message: string, context?: Record<string, any>): void {
    logWarn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error | unknown, context?: Record<string, any>): void {
    logError(message, error, { ...this.context, ...context });
  }

  debug(message: string, context?: Record<string, any>): void {
    logDebug(message, { ...this.context, ...context });
  }

  // Create a child logger with additional context
  child(additionalContext: Record<string, any>): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }
}

export default {
  info: logInfo,
  warn: logWarn,
  error: logError,
  debug: logDebug,
  createLogger,
  createRequestLogger,
  Logger,
};
