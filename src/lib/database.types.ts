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
          saved_at: string
          created_at: string
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
          saved_at?: string
          created_at?: string
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
          saved_at?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
