/**
 * Timeout Utilities for Request Handling
 *
 * Provides timeout protection for:
 * - External API calls (fetch requests)
 * - Long-running async operations
 * - Database queries
 * - File uploads/downloads
 * - Background jobs
 *
 * Features:
 * - AbortController support for fetch requests
 * - Configurable timeouts per operation type
 * - Exponential backoff for retries
 * - Proper resource cleanup on timeout
 */

export interface TimeoutConfig {
  /**
   * Timeout duration in milliseconds
   */
  timeoutMs: number;

  /**
   * Optional operation name for logging
   */
  operation?: string;

  /**
   * Whether to retry on timeout
   */
  retry?: boolean;

  /**
   * Maximum number of retries (if retry is enabled)
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds (doubles with each retry)
   */
  retryDelayMs?: number;
}

export interface FetchWithTimeoutOptions extends RequestInit {
  /**
   * Timeout in milliseconds (default: 30000)
   */
  timeoutMs?: number;

  /**
   * Whether to retry on timeout or network errors
   */
  retry?: boolean;

  /**
   * Maximum number of retries
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds
   */
  retryDelayMs?: number;

  /**
   * Custom error handler for logging
   */
  onError?: (error: Error, attempt: number) => void;
}

/**
 * Predefined timeout configurations for common operations
 */
export const TimeoutPresets = {
  /** External API calls (Grants.gov, OpenAI, etc.) */
  EXTERNAL_API: 30000, // 30 seconds

  /** Fast external API calls (OAuth token exchange, etc.) */
  EXTERNAL_API_FAST: 10000, // 10 seconds

  /** Database operations (queries, inserts, updates) */
  DATABASE: 15000, // 15 seconds

  /** File uploads */
  FILE_UPLOAD: 60000, // 60 seconds

  /** File downloads */
  FILE_DOWNLOAD: 60000, // 60 seconds

  /** PDF fetching/processing */
  PDF_FETCH: 30000, // 30 seconds

  /** AI operations (OpenAI, etc.) */
  AI_OPERATION: 45000, // 45 seconds

  /** Background jobs (default, can be overridden per job) */
  BACKGROUND_JOB: 300000, // 5 minutes

  /** OAuth callbacks */
  OAUTH_CALLBACK: 10000, // 10 seconds

  /** Grant search operations */
  GRANT_SEARCH: 25000, // 25 seconds
} as const;

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
  public readonly isTimeout = true;

  constructor(message: string, public readonly operation?: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wraps a fetch request with timeout and retry logic
 *
 * @param url - URL to fetch
 * @param options - Fetch options with timeout configuration
 * @returns Response from fetch
 * @throws TimeoutError if request times out
 *
 * @example
 * ```typescript
 * const response = await fetchWithTimeout('https://api.example.com/data', {
 *   timeoutMs: 10000,
 *   retry: true,
 *   maxRetries: 3,
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ foo: 'bar' })
 * });
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = TimeoutPresets.EXTERNAL_API,
    retry = false,
    maxRetries = 3,
    retryDelayMs = 1000,
    onError,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  const maxAttempts = retry ? maxRetries + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Add exponential backoff delay for retries
    if (attempt > 0) {
      const delay = retryDelayMs * Math.pow(2, attempt - 1);
      console.log(`[Timeout] Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`);
      await sleep(delay);
    }

    // Create AbortController for this attempt
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Check if error is due to abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new TimeoutError(
          `Request timed out after ${timeoutMs}ms`,
          `fetch: ${url}`
        );
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Call error handler if provided
      if (onError) {
        onError(lastError, attempt + 1);
      }

      // Log the error
      console.error(`[Timeout] Attempt ${attempt + 1}/${maxAttempts} failed:`, lastError.message);

      // If this is the last attempt or we shouldn't retry this error, throw
      if (attempt === maxAttempts - 1) {
        throw lastError;
      }

      // Don't retry on certain errors (4xx client errors, except 408 and 429)
      if (lastError instanceof Error && 'status' in lastError) {
        const status = (lastError as any).status;
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          throw lastError;
        }
      }
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Unknown error in fetchWithTimeout');
}

/**
 * Wraps any async operation with a timeout
 *
 * @param operation - Async function to execute
 * @param config - Timeout configuration
 * @returns Result of the operation
 * @throws TimeoutError if operation times out
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   async () => {
 *     return await someSlowDatabaseQuery();
 *   },
 *   { timeoutMs: 15000, operation: 'database query' }
 * );
 * ```
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  config: TimeoutConfig
): Promise<T> {
  const {
    timeoutMs,
    operation: operationName,
    retry = false,
    maxRetries = 3,
    retryDelayMs = 1000,
  } = config;

  let lastError: Error | null = null;
  const maxAttempts = retry ? maxRetries + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Add exponential backoff delay for retries
    if (attempt > 0) {
      const delay = retryDelayMs * Math.pow(2, attempt - 1);
      console.log(`[Timeout] Retry attempt ${attempt}/${maxRetries} for ${operationName || 'operation'} after ${delay}ms delay`);
      await sleep(delay);
    }

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError(
            `Operation timed out after ${timeoutMs}ms`,
            operationName
          ));
        }, timeoutMs);
      });

      // Race the operation against the timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise,
      ]);

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.error(
        `[Timeout] Attempt ${attempt + 1}/${maxAttempts} failed for ${operationName || 'operation'}:`,
        lastError.message
      );

      // If this is the last attempt, throw
      if (attempt === maxAttempts - 1) {
        throw lastError;
      }
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Unknown error in withTimeout');
}

/**
 * Wraps a database query with timeout protection
 *
 * @param queryFn - Function that executes the database query
 * @param timeoutMs - Timeout in milliseconds (default: 15000)
 * @param operationName - Name of the operation for logging
 * @returns Result of the query
 *
 * @example
 * ```typescript
 * const { data, error } = await withDatabaseTimeout(
 *   () => supabase.from('grants').select('*').eq('id', grantId),
 *   15000,
 *   'fetch grant by id'
 * );
 * ```
 */
export async function withDatabaseTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = TimeoutPresets.DATABASE,
  operationName?: string
): Promise<T> {
  return withTimeout(queryFn, {
    timeoutMs,
    operation: operationName ? `database: ${operationName}` : 'database query',
  });
}

/**
 * Creates a timeout-aware fetch wrapper for external APIs
 * with automatic retry logic
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param config - Timeout configuration
 * @returns Response from fetch
 *
 * @example
 * ```typescript
 * const response = await fetchExternalAPI(
 *   'https://api.grants.gov/v1/api/search2',
 *   {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(searchParams)
 *   },
 *   {
 *     timeoutMs: 25000,
 *     retry: true,
 *     maxRetries: 3
 *   }
 * );
 * ```
 */
export async function fetchExternalAPI(
  url: string,
  options: RequestInit = {},
  config: {
    timeoutMs?: number;
    retry?: boolean;
    maxRetries?: number;
    retryDelayMs?: number;
  } = {}
): Promise<Response> {
  const {
    timeoutMs = TimeoutPresets.EXTERNAL_API,
    retry = true,
    maxRetries = 3,
    retryDelayMs = 1000,
  } = config;

  return fetchWithTimeout(url, {
    ...options,
    timeoutMs,
    retry,
    maxRetries,
    retryDelayMs,
    onError: (error, attempt) => {
      console.error(`[External API] ${url} - Attempt ${attempt} failed:`, error.message);
    },
  });
}

/**
 * Checks if an error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError ||
         (error instanceof Error && error.name === 'TimeoutError') ||
         (error instanceof Error && error.name === 'AbortError');
}

/**
 * Middleware to add timeout to request handler
 * Wraps the entire request handler with a timeout
 *
 * @param handler - Request handler function
 * @param timeoutMs - Timeout in milliseconds
 * @returns Wrapped handler with timeout protection
 *
 * @example
 * ```typescript
 * export default withRequestTimeout(
 *   async (req, res) => {
 *     // Your handler code
 *   },
 *   30000 // 30 second timeout
 * );
 * ```
 */
export function withRequestTimeout<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  timeoutMs: number
): T {
  return (async (...args: any[]) => {
    const [req, res] = args;

    try {
      return await withTimeout(
        () => handler(...args),
        { timeoutMs, operation: `request: ${req.method} ${req.url}` }
      );
    } catch (error) {
      if (isTimeoutError(error)) {
        console.error(`[Request Timeout] ${req.method} ${req.url} timed out after ${timeoutMs}ms`);

        // Return 408 Request Timeout
        return res.status(408).json({
          error: 'Request Timeout',
          message: `Request processing exceeded ${timeoutMs}ms timeout`,
          timeout_ms: timeoutMs,
        });
      }

      // Re-throw non-timeout errors
      throw error;
    }
  }) as T;
}

/**
 * Exponential backoff calculator
 * Useful for custom retry logic
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @returns Delay in milliseconds with jitter
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter (random 0-20% variance) to prevent thundering herd
  const jitter = cappedDelay * 0.2 * Math.random();

  return Math.floor(cappedDelay + jitter);
}
