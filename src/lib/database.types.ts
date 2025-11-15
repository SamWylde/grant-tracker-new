export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string | null
          primary_state: string | null
          focus_areas: string[] | null
          logo_url: string | null
          created_at: string
          updated_at: string
          org_size: string | null
          annual_budget_range: string | null
          primary_locations: string[] | null
          service_areas: string[] | null
          focus_categories: string[] | null
          min_grant_amount: number | null
          max_grant_amount: number | null
          eligibility_notes: string | null
          auto_filter_enabled: boolean
        }
        Insert: {
          id?: string
          name: string
          slug?: string | null
          primary_state?: string | null
          focus_areas?: string[] | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
          org_size?: string | null
          annual_budget_range?: string | null
          primary_locations?: string[] | null
          service_areas?: string[] | null
          focus_categories?: string[] | null
          min_grant_amount?: number | null
          max_grant_amount?: number | null
          eligibility_notes?: string | null
          auto_filter_enabled?: boolean
        }
        Update: {
          id?: string
          name?: string
          slug?: string | null
          primary_state?: string | null
          focus_areas?: string[] | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
          org_size?: string | null
          annual_budget_range?: string | null
          primary_locations?: string[] | null
          service_areas?: string[] | null
          focus_categories?: string[] | null
          min_grant_amount?: number | null
          max_grant_amount?: number | null
          eligibility_notes?: string | null
          auto_filter_enabled?: boolean
        }
      }
      user_profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      }
      org_members: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: string
          joined_at: string
          invited_by: string | null
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role?: string
          joined_at?: string
          invited_by?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: string
          joined_at?: string
          invited_by?: string | null
        }
      }
      team_invitations: {
        Row: {
          id: string
          org_id: string
          email: string
          role: string
          invited_by: string
          invited_at: string
          expires_at: string
          accepted_at: string | null
          revoked_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          email: string
          role?: string
          invited_by: string
          invited_at?: string
          expires_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          email?: string
          role?: string
          invited_by?: string
          invited_at?: string
          expires_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
        }
      }
      user_preferences: {
        Row: {
          user_id: string
          weekly_summary_emails: boolean
          product_updates: boolean
          updated_at: string
        }
        Insert: {
          user_id: string
          weekly_summary_emails?: boolean
          product_updates?: boolean
          updated_at?: string
        }
        Update: {
          user_id?: string
          weekly_summary_emails?: boolean
          product_updates?: boolean
          updated_at?: string
        }
      }
      organization_settings: {
        Row: {
          org_id: string
          deadline_reminders_30d: boolean
          deadline_reminders_14d: boolean
          deadline_reminders_7d: boolean
          deadline_reminders_3d: boolean
          deadline_reminders_1d: boolean
          deadline_reminders_0d: boolean
          daily_task_emails: boolean
          ics_token: string | null
          google_calendar_connected: boolean
          google_calendar_token: string | null
          plan_name: string
          plan_status: string
          trial_ends_at: string | null
          next_renewal_at: string | null
          updated_at: string
        }
        Insert: {
          org_id: string
          deadline_reminders_30d?: boolean
          deadline_reminders_14d?: boolean
          deadline_reminders_7d?: boolean
          deadline_reminders_3d?: boolean
          deadline_reminders_1d?: boolean
          deadline_reminders_0d?: boolean
          daily_task_emails?: boolean
          ics_token?: string | null
          google_calendar_connected?: boolean
          google_calendar_token?: string | null
          plan_name?: string
          plan_status?: string
          trial_ends_at?: string | null
          next_renewal_at?: string | null
          updated_at?: string
        }
        Update: {
          org_id?: string
          deadline_reminders_30d?: boolean
          deadline_reminders_14d?: boolean
          deadline_reminders_7d?: boolean
          deadline_reminders_3d?: boolean
          deadline_reminders_1d?: boolean
          deadline_reminders_0d?: boolean
          daily_task_emails?: boolean
          ics_token?: string | null
          google_calendar_connected?: boolean
          google_calendar_token?: string | null
          plan_name?: string
          plan_status?: string
          trial_ends_at?: string | null
          next_renewal_at?: string | null
          updated_at?: string
        }
      }
      org_grants_saved: {
        Row: {
          id: string
          org_id: string
          user_id: string
          external_source: string
          external_id: string
          title: string
          agency: string | null
          aln: string | null
          open_date: string | null
          close_date: string | null
          loi_deadline: string | null
          saved_at: string
          created_at: string
          status: string
          assigned_to: string | null
          priority: string
          stage_updated_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          external_source?: string
          external_id: string
          title: string
          agency?: string | null
          aln?: string | null
          open_date?: string | null
          close_date?: string | null
          loi_deadline?: string | null
          saved_at?: string
          created_at?: string
          status?: string
          assigned_to?: string | null
          priority?: string
          stage_updated_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          external_source?: string
          external_id?: string
          title?: string
          agency?: string | null
          aln?: string | null
          open_date?: string | null
          close_date?: string | null
          loi_deadline?: string | null
          saved_at?: string
          created_at?: string
          status?: string
          assigned_to?: string | null
          priority?: string
          stage_updated_at?: string | null
          notes?: string | null
        }
      }
      permissions: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          created_at?: string
        }
      }
      roles: {
        Row: {
          id: string
          name: string
          display_name: string
          description: string | null
          is_system_role: boolean
          org_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          description?: string | null
          is_system_role?: boolean
          org_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          description?: string | null
          is_system_role?: boolean
          org_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      role_permissions: {
        Row: {
          role_id: string
          permission_id: string
        }
        Insert: {
          role_id: string
          permission_id: string
        }
        Update: {
          role_id?: string
          permission_id?: string
        }
      }
      user_role_assignments: {
        Row: {
          id: string
          user_id: string
          role_id: string
          org_id: string
          assigned_by: string
          assigned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role_id: string
          org_id: string
          assigned_by: string
          assigned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role_id?: string
          org_id?: string
          assigned_by?: string
          assigned_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_has_permission: {
        Args: {
          p_user_id: string
          p_org_id: string
          p_permission_name: string
        }
        Returns: boolean
      }
      get_user_permissions: {
        Args: {
          p_user_id: string
          p_org_id: string
        }
        Returns: Array<{
          id: string
          permission_name: string
          description: string | null
        }>
      }
      get_user_roles: {
        Args: {
          p_user_id: string
          p_org_id: string
        }
        Returns: Array<{
          role_id: string
          role_name: string
          description: string | null
        }>
      }
      get_org_team_members: {
        Args: {
          org_uuid: string
        }
        Returns: Array<{
          user_id: string
          full_name: string | null
          email: string | null
          avatar_url: string | null
          role: string
          joined_at: string
        }>
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
