import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import type { OrganizationSettings } from '../types/api';
import { PLAN_NAMES, PLAN_STATUSES, type PlanName, type PlanStatus } from '../constants';

export type AIFeatureAccess = 'none' | 'limited' | 'full';

interface AIFeaturesResult {
  hasAIAccess: boolean;
  accessLevel: AIFeatureAccess;
  plan: string;
  loading: boolean;
}

/**
 * Hook to check AI feature access based on organization plan
 *
 * Access levels:
 * - free: no access to AI features
 * - starter: limited access to AI features
 * - pro: full access to AI features
 * - enterprise: full access to AI features (same as pro)
 */
export function useAIFeatures(): AIFeaturesResult {
  const { currentOrg } = useOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ['orgSettings', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return null;

      const { data, error } = await supabase
        .from('organization_settings')
        .select('plan_name, plan_status')
        .eq('org_id', currentOrg.id)
        .single();

      if (error) {
        console.error('Error fetching organization settings:', error);
        return null;
      }

      return data;
    },
    enabled: !!currentOrg,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const settings = data as unknown as OrganizationSettings | null;
  const plan: PlanName = settings?.plan_name || PLAN_NAMES.FREE;
  const status: PlanStatus = settings?.plan_status || PLAN_STATUSES.ACTIVE;

  // Determine access level
  let accessLevel: AIFeatureAccess = 'none';
  let hasAIAccess = false;

  // Only grant access if plan is active
  if (status === PLAN_STATUSES.ACTIVE) {
    if (plan === PLAN_NAMES.STARTER) {
      accessLevel = 'limited';
      hasAIAccess = true;
    } else if (plan === PLAN_NAMES.PRO || plan === PLAN_NAMES.ENTERPRISE) {
      accessLevel = 'full';
      hasAIAccess = true;
    }
  }

  return {
    hasAIAccess,
    accessLevel,
    plan,
    loading: isLoading,
  };
}
