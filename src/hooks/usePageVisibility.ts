import { useEffect, useState } from 'react';

/**
 * Hook to track page visibility state
 * Returns true when the page is visible, false when hidden/inactive
 *
 * Useful for:
 * - Pausing/resuming polling when tab is inactive
 * - Stopping animations when page is not visible
 * - Managing resource usage
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(
    typeof document !== 'undefined' ? !document.hidden : true
  );

  useEffect(() => {
    // Check if document API is available (SSR safety)
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup listener on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
