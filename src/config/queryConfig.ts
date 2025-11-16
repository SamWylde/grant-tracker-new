/**
 * React Query Configuration
 *
 * Standard cache times for different data types to ensure consistent
 * caching behavior across the application and optimize performance.
 */

// Cache time constants (in milliseconds)
export const CACHE_TIMES = {
  /**
   * REAL_TIME: 0ms
   * For data that should never be cached (always fetch fresh)
   * Use for: Alerts, notifications, real-time updates
   */
  REAL_TIME: 0,

  /**
   * FAST: 30 seconds (30,000ms)
   * For frequently changing data that needs to be relatively fresh
   * Use for: User data, session info, current user state
   */
  FAST: 30 * 1000,

  /**
   * NORMAL: 5 minutes (300,000ms)
   * For standard data that doesn't change frequently
   * Use for: Grant lists, saved grants, search results
   */
  NORMAL: 5 * 60 * 1000,

  /**
   * SLOW: 15 minutes (900,000ms)
   * For relatively static data
   * Use for: Organization settings, team members, reference data
   */
  SLOW: 15 * 60 * 1000,

  /**
   * VERY_SLOW: 1 hour (3,600,000ms)
   * For data that rarely changes
   * Use for: System configuration, static lookups, permissions
   */
  VERY_SLOW: 60 * 60 * 1000,
} as const;

// Stale time constants (how long until data is considered stale)
// Stale time determines when React Query will refetch in the background
export const STALE_TIMES = {
  /**
   * REAL_TIME: 0ms
   * Data is immediately stale - refetch on every mount
   */
  REAL_TIME: 0,

  /**
   * FAST: 10 seconds
   * Data becomes stale after 10 seconds
   */
  FAST: 10 * 1000,

  /**
   * NORMAL: 2 minutes
   * Data becomes stale after 2 minutes
   */
  NORMAL: 2 * 60 * 1000,

  /**
   * SLOW: 10 minutes
   * Data becomes stale after 10 minutes
   */
  SLOW: 10 * 60 * 1000,

  /**
   * VERY_SLOW: 30 minutes
   * Data becomes stale after 30 minutes
   */
  VERY_SLOW: 30 * 60 * 1000,
} as const;

/**
 * Predefined query configurations for common use cases
 */
export const QUERY_CONFIGS = {
  /**
   * For real-time data (alerts, notifications)
   */
  realTime: {
    cacheTime: CACHE_TIMES.REAL_TIME,
    staleTime: STALE_TIMES.REAL_TIME,
    refetchOnMount: 'always' as const,
    refetchOnWindowFocus: true,
  },

  /**
   * For user data and session information
   */
  userData: {
    cacheTime: CACHE_TIMES.FAST,
    staleTime: STALE_TIMES.FAST,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  },

  /**
   * For grant lists and search results
   */
  grants: {
    cacheTime: CACHE_TIMES.NORMAL,
    staleTime: STALE_TIMES.NORMAL,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  },

  /**
   * For organization settings and team data
   */
  organization: {
    cacheTime: CACHE_TIMES.SLOW,
    staleTime: STALE_TIMES.SLOW,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  },

  /**
   * For permissions and system configuration
   */
  permissions: {
    cacheTime: CACHE_TIMES.VERY_SLOW,
    staleTime: STALE_TIMES.VERY_SLOW,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  },
} as const;

/**
 * Default React Query configuration
 * Apply this to your QueryClient
 */
export const DEFAULT_QUERY_CONFIG = {
  queries: {
    cacheTime: CACHE_TIMES.NORMAL,
    staleTime: STALE_TIMES.NORMAL,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },
  mutations: {
    retry: 0, // Don't retry mutations by default
  },
};

/**
 * Helper function to create a custom query config
 * @param cacheLevel - The cache level (realTime, fast, normal, slow, verySlow)
 * @param overrides - Optional overrides for the config
 */
export function createQueryConfig(
  cacheLevel: keyof typeof QUERY_CONFIGS,
  overrides?: Partial<typeof QUERY_CONFIGS.grants>
) {
  return {
    ...QUERY_CONFIGS[cacheLevel],
    ...overrides,
  };
}
