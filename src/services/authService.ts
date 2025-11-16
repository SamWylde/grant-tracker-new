/**
 * Authentication Service
 *
 * Abstracts all authentication and user-related operations from components.
 * Handles authentication, session management, and user profile operations.
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import type {
  User,
  Session,
  SignInWithPasswordCredentials,
  SignUpWithPasswordCredentials,
} from '@supabase/supabase-js';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

export type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update'];

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type AuthUser = User;
export type AuthSession = Session;

export interface AuthResponse {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

export interface UserWithProfile {
  user: User;
  profile: UserProfile | null;
  preferences: UserPreferences | null;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
  timezone?: string;
}

export interface UpdateProfileData {
  full_name?: string;
  avatar_url?: string;
  timezone?: string;
}

export interface ResetPasswordData {
  email: string;
  redirectTo?: string;
}

export interface UpdatePasswordData {
  newPassword: string;
}

// =====================================================
// AUTHENTICATION OPERATIONS
// =====================================================

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const credentials: SignInWithPasswordCredentials = {
      email,
      password,
    };

    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
      console.error('[AuthService] Sign in error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      user: data.user ?? undefined,
      session: data.session ?? undefined,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected sign in error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sign up with email and password
 */
export async function signUp(signUpData: SignUpData): Promise<AuthResponse> {
  try {
    const credentials: SignUpWithPasswordCredentials = {
      email: signUpData.email,
      password: signUpData.password,
      options: {
        data: {
          full_name: signUpData.fullName,
          timezone: signUpData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    };

    const { data, error } = await supabase.auth.signUp(credentials);

    if (error) {
      console.error('[AuthService] Sign up error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Create user profile
    if (data.user) {
      const profileResult = await createUserProfile({
        id: data.user.id,
        full_name: signUpData.fullName || null,
        timezone: signUpData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (!profileResult.success) {
        console.error('[AuthService] Failed to create user profile:', profileResult.error);
      }

      // Create user preferences with defaults
      const preferencesResult = await createUserPreferences(data.user.id);
      if (!preferencesResult.success) {
        console.error('[AuthService] Failed to create user preferences:', preferencesResult.error);
      }
    }

    return {
      success: true,
      user: data.user ?? undefined,
      session: data.session ?? undefined,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected sign up error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[AuthService] Sign out error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected sign out error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Request a password reset email
 */
export async function requestPasswordReset(
  data: ResetPasswordData
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });

    if (error) {
      console.error('[AuthService] Password reset request error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected password reset request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update user password
 */
export async function updatePassword(
  data: UpdatePasswordData
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: data.newPassword,
    });

    if (error) {
      console.error('[AuthService] Password update error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected password update error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update user email
 */
export async function updateEmail(newEmail: string): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) {
      console.error('[AuthService] Email update error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected email update error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// SESSION MANAGEMENT
// =====================================================

/**
 * Get the current session
 */
export async function getCurrentSession(): Promise<ServiceResponse<Session>> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[AuthService] Get session error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data.session) {
      return {
        success: false,
        error: 'No active session',
      };
    }

    return {
      success: true,
      data: data.session,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected get session error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the current user
 */
export async function getCurrentUser(): Promise<ServiceResponse<User>> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error('[AuthService] Get user error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'No authenticated user',
      };
    }

    return {
      success: true,
      data: data.user,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected get user error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Refresh the current session
 */
export async function refreshSession(): Promise<ServiceResponse<Session>> {
  try {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      console.error('[AuthService] Refresh session error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data.session) {
      return {
        success: false,
        error: 'Failed to refresh session',
      };
    }

    return {
      success: true,
      data: data.session,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected refresh session error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Subscribe to authentication state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return data.subscription;
}

// =====================================================
// USER PROFILE OPERATIONS
// =====================================================

/**
 * Create a user profile
 */
export async function createUserProfile(
  profile: UserProfileInsert
): Promise<ServiceResponse<UserProfile>> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert(profile as never)
      .select()
      .single();

    if (error) {
      console.error('[AuthService] Create profile error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected create profile error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user profile by user ID
 */
export async function getUserProfile(
  userId: string
): Promise<ServiceResponse<UserProfile>> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[AuthService] Get profile error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected get profile error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: UserProfileUpdate
): Promise<ServiceResponse<UserProfile>> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[AuthService] Update profile error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected update profile error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current user with profile and preferences
 */
export async function getCurrentUserWithProfile(): Promise<ServiceResponse<UserWithProfile>> {
  try {
    const userResponse = await getCurrentUser();
    if (!userResponse.success || !userResponse.data) {
      return {
        success: false,
        error: userResponse.error || 'No authenticated user',
      };
    }

    const user = userResponse.data;

    // Fetch profile
    const profileResponse = await getUserProfile(user.id);
    const profile = profileResponse.success ? profileResponse.data : null;

    // Fetch preferences
    const preferencesResponse = await getUserPreferences(user.id);
    const preferences = preferencesResponse.success ? preferencesResponse.data : null;

    return {
      success: true,
      data: {
        user,
        profile: profile || null,
        preferences: preferences || null,
      },
    };
  } catch (error) {
    console.error('[AuthService] Unexpected error getting user with profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// USER PREFERENCES
// =====================================================

/**
 * Create user preferences with defaults
 */
export async function createUserPreferences(
  userId: string
): Promise<ServiceResponse<UserPreferences>> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: userId,
        weekly_summary_emails: true,
        product_updates: true,
      } as never)
      .select()
      .single();

    if (error) {
      console.error('[AuthService] Create preferences error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected create preferences error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user preferences
 */
export async function getUserPreferences(
  userId: string
): Promise<ServiceResponse<UserPreferences>> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[AuthService] Get preferences error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected get preferences error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  updates: UserPreferencesUpdate
): Promise<ServiceResponse<UserPreferences>> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[AuthService] Update preferences error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected update preferences error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch (error) {
    console.error('[AuthService] Error checking authentication:', error);
    return false;
  }
}

/**
 * Get user's organizations
 */
export async function getUserOrganizations(
  userId: string
): Promise<ServiceResponse<Array<{
  org_id: string;
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string | null;
  };
}>>> {
  try {
    const { data, error } = await supabase
      .from('org_members')
      .select(`
        org_id,
        role,
        organization:organizations!org_members_org_id_fkey(
          id,
          name,
          slug
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('[AuthService] Error fetching user organizations:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data as any,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected error fetching user organizations:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate session and return user data
 */
export async function validateSession(): Promise<ServiceResponse<{
  user: User;
  session: Session;
}>> {
  try {
    const sessionResponse = await getCurrentSession();
    if (!sessionResponse.success || !sessionResponse.data) {
      return {
        success: false,
        error: sessionResponse.error || 'No valid session',
      };
    }

    const userResponse = await getCurrentUser();
    if (!userResponse.success || !userResponse.data) {
      return {
        success: false,
        error: userResponse.error || 'No authenticated user',
      };
    }

    return {
      success: true,
      data: {
        user: userResponse.data,
        session: sessionResponse.data,
      },
    };
  } catch (error) {
    console.error('[AuthService] Unexpected error validating session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
