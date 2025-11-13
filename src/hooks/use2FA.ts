/**
 * Custom hook for 2FA operations
 * Provides utilities for checking 2FA status and requirements
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
  backupCodesRemaining: number;
  requiredByOrg: boolean;
  organizations: Array<{
    name: string;
    role: string;
    requires2FA: boolean;
  }>;
}

export function use2FAStatus() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/2fa/status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }

      setStatus(data);
    } catch (err) {
      console.error('Error fetching 2FA status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load 2FA status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
  };
}

/**
 * Check if user needs 2FA verification
 * This should be called after successful password login
 */
export async function check2FARequired(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return false;
    }

    const response = await fetch('/api/2fa/status', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error checking 2FA status:', data.error);
      return false;
    }

    return data.enabled === true;
  } catch (error) {
    console.error('Error checking 2FA requirement:', error);
    return false;
  }
}

/**
 * Verify 2FA code
 */
export async function verify2FACode(code: string, userId?: string): Promise<{
  success: boolean;
  error?: string;
  isBackupCode?: boolean;
  remainingBackupCodes?: number;
}> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch('/api/2fa/verify', {
      method: 'POST',
      headers: {
        'Authorization': session ? `Bearer ${session.access_token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, userId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Verification failed',
      };
    }

    return {
      success: true,
      isBackupCode: data.isBackupCode,
      remainingBackupCodes: data.remainingBackupCodes,
    };
  } catch (error) {
    console.error('Error verifying 2FA code:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}
