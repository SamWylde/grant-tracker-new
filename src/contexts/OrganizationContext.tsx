import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Organization = Database['public']['Tables']['organizations']['Row'];

interface OrganizationContextType {
  currentOrg: Organization | null;
  userOrgs: Organization[];
  userRole: 'admin' | 'contributor' | null;
  loading: boolean;
  error: Error | null;
  switchOrg: (orgId: string) => void;
  refreshOrgs: () => Promise<void>;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);
  const [userRole, setUserRole] = useState<'admin' | 'contributor' | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load user's organizations
  const loadOrganizations = async () => {
    if (!user) {
      setUserOrgs([]);
      setCurrentOrg(null);
      setUserRole(null);
      setIsPlatformAdmin(false);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get platform admin status
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
      } else {
        setIsPlatformAdmin((profileData as any)?.is_platform_admin || false);
      }

      // Get organizations the user is a member of
      const { data: memberships, error: membershipsError } = await supabase
        .from('org_members')
        .select('org_id, role, organizations(*)')
        .eq('user_id', user.id);

      if (membershipsError) throw membershipsError;

      const orgs = (memberships || [])
        .map((m: any) => m.organizations)
        .filter(Boolean);

      setUserOrgs(orgs);

      // Set current org from localStorage or first org
      const savedOrgId = localStorage.getItem('currentOrgId');
      let orgToSet = orgs.find((o: Organization) => o.id === savedOrgId) || orgs[0] || null;

      if (orgToSet) {
        const membership = memberships?.find((m: any) => m.org_id === orgToSet?.id);
        setCurrentOrg(orgToSet);
        const role = (membership as any)?.role;
        setUserRole(role ? (role as 'admin' | 'contributor') : null);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
      setError(error instanceof Error ? error : new Error('Failed to load organizations'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, [user]);

  // Switch to a different organization
  const switchOrg = (orgId: string) => {
    const org = userOrgs.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem('currentOrgId', orgId);

      // Update role for new org
      supabase
        .from('org_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user?.id || '')
        .single()
        .then(({ data }) => {
          setUserRole((data as any)?.role as 'admin' | 'contributor' | null);
        });
    }
  };

  const value = {
    currentOrg,
    userOrgs,
    userRole,
    loading,
    error,
    switchOrg,
    refreshOrgs: loadOrganizations,
    isAdmin: userRole === 'admin',
    isPlatformAdmin,
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
