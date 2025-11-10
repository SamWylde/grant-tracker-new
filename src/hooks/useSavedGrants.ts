import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';

export interface SavedGrant {
  id: string;
  org_id: string;
  user_id: string;
  external_id: string;
  external_source: string;
  title: string;
  agency: string | null;
  aln: string | null;
  open_date: string | null;
  close_date: string | null;
  status: string;
  priority: string | null;
  assigned_to: string | null;
  notes: string | null;
  saved_at: string;
  stage_updated_at: string | null;
  created_at: string;
}

interface SavedGrantsResponse {
  grants: SavedGrant[];
}

export function useSavedGrants() {
  const { currentOrg } = useOrganization();

  return useQuery<SavedGrantsResponse>({
    queryKey: ['savedGrants', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) {
        return { grants: [] };
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/saved?org_id=${currentOrg.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch saved grants');
      }

      return response.json();
    },
    enabled: !!currentOrg?.id,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useSavedGrantIds() {
  const { data: savedGrants, ...rest } = useSavedGrants();

  // Memoize the Set to avoid rebuilding on every render
  const savedGrantIds = useMemo(
    () => new Set(savedGrants?.grants.map((g) => g.external_id) || []),
    [savedGrants]
  );

  return {
    savedGrantIds,
    savedGrants,
    ...rest,
  };
}
