export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          account_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          invited_locations: string[]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          account_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          invited_locations?: string[]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          account_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_locations?: string[]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invites_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_members: {
        Row: {
          account_id: string
          created_at: string
          role: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["account_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_rate_limits: {
        Row: {
          call_count: number
          endpoint: string
          user_id: string
          window_start: string
        }
        Insert: {
          call_count?: number
          endpoint: string
          user_id: string
          window_start: string
        }
        Update: {
          call_count?: number
          endpoint?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      campaign_addons: {
        Row: {
          addon_type: string
          campaign_id: string
          created_at: string
          custom_icon: string | null
          custom_label: string | null
          id: string
          notes: string | null
        }
        Insert: {
          addon_type: string
          campaign_id: string
          created_at?: string
          custom_icon?: string | null
          custom_label?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          addon_type?: string
          campaign_id?: string
          created_at?: string
          custom_icon?: string | null
          custom_label?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_addons_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_agent_instructions: {
        Row: {
          campaign_id: string
          chat_instructions: string
          created_at: string
          dev_instructions: string
          generate_instructions: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          chat_instructions?: string
          created_at?: string
          dev_instructions?: string
          generate_instructions?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          chat_instructions?: string
          created_at?: string
          dev_instructions?: string
          generate_instructions?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_budgets: {
        Row: {
          accepted: boolean
          allocations: Json
          campaign_id: string
          created_at: string
          id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          accepted?: boolean
          allocations?: Json
          campaign_id: string
          created_at?: string
          id?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          accepted?: boolean
          allocations?: Json
          campaign_id?: string
          created_at?: string
          id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_budgets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_channels: {
        Row: {
          campaign_id: string
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["platform_type"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["platform_type"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_channels_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_vault: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          location_id: string
          platform: string | null
          scheduled_date: string | null
          status: string | null
          target_audience: string | null
          text_copy: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location_id: string
          platform?: string | null
          scheduled_date?: string | null
          status?: string | null
          target_audience?: string | null
          text_copy?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location_id?: string
          platform?: string | null
          scheduled_date?: string | null
          status?: string | null
          target_audience?: string | null
          text_copy?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          duration_unit: string | null
          duration_value: number | null
          end_date: string | null
          focus: string | null
          generation_error: string | null
          generation_status: string | null
          id: string
          landing_page_html: string | null
          landing_page_url: string | null
          location_id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          strategy: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_unit?: string | null
          duration_value?: number | null
          end_date?: string | null
          focus?: string | null
          generation_error?: string | null
          generation_status?: string | null
          id?: string
          landing_page_html?: string | null
          landing_page_url?: string | null
          location_id: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          strategy?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_unit?: string | null
          duration_value?: number | null
          end_date?: string | null
          focus?: string | null
          generation_error?: string | null
          generation_status?: string | null
          id?: string
          landing_page_html?: string | null
          landing_page_url?: string | null
          location_id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          strategy?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      channel_credentials: {
        Row: {
          created_at: string
          id: string
          location_id: string
          password: string | null
          platform_name: string
          platform_url: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          password?: string | null
          platform_name: string
          platform_url?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          password?: string | null
          platform_name?: string
          platform_url?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      channel_posts: {
        Row: {
          bundle_social_post_id: string | null
          campaign_channel_id: string
          created_at: string
          id: string
          image_url: string | null
          publish_error: string | null
          published_at: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          text_content: string | null
          title: string | null
          updated_at: string
          video_status: string | null
          video_url: string | null
          voiceover_script: string | null
        }
        Insert: {
          bundle_social_post_id?: string | null
          campaign_channel_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          publish_error?: string | null
          published_at?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          text_content?: string | null
          title?: string | null
          updated_at?: string
          video_status?: string | null
          video_url?: string | null
          voiceover_script?: string | null
        }
        Update: {
          bundle_social_post_id?: string | null
          campaign_channel_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          publish_error?: string | null
          published_at?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          text_content?: string | null
          title?: string | null
          updated_at?: string
          video_status?: string | null
          video_url?: string | null
          voiceover_script?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_posts_campaign_channel_id_fkey"
            columns: ["campaign_channel_id"]
            isOneToOne: false
            referencedRelation: "campaign_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          account_id: string
          content: string
          created_at: string
          doc_type: Database["public"]["Enums"]["kb_document_type"]
          id: string
          location_id: string | null
          metadata: Json | null
          scope: Database["public"]["Enums"]["kb_scope"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["kb_document_type"]
          id?: string
          location_id?: string | null
          metadata?: Json | null
          scope?: Database["public"]["Enums"]["kb_scope"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["kb_document_type"]
          id?: string
          location_id?: string | null
          metadata?: Json | null
          scope?: Database["public"]["Enums"]["kb_scope"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      location_members: {
        Row: {
          created_at: string
          location_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          location_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_members_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          account_id: string
          address: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_assignments: {
        Row: {
          assigned_by: string
          client_user_id: string
          created_at: string
          id: string
          manager_user_id: string
        }
        Insert: {
          assigned_by: string
          client_user_id: string
          created_at?: string
          id?: string
          manager_user_id: string
        }
        Update: {
          assigned_by?: string
          client_user_id?: string
          created_at?: string
          id?: string
          manager_user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          campaign_id: string | null
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string
          subject: string
        }
        Insert: {
          body?: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id: string
          subject?: string
        }
        Update: {
          body?: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string | null
          brand_dna_url: string | null
          budget_target: number | null
          bundle_social_team_id: string | null
          campaign_focus: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          onboarding_reports_completed_at: string | null
          onboarding_reports_done: number
          onboarding_reports_error: string | null
          onboarding_reports_started_at: string | null
          onboarding_reports_status: string
          onboarding_reports_total: number
          parent_account_id: string | null
          practice_name: string | null
          target_audience: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          account_id?: string | null
          brand_dna_url?: string | null
          budget_target?: number | null
          bundle_social_team_id?: string | null
          campaign_focus?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_reports_completed_at?: string | null
          onboarding_reports_done?: number
          onboarding_reports_error?: string | null
          onboarding_reports_started_at?: string | null
          onboarding_reports_status?: string
          onboarding_reports_total?: number
          parent_account_id?: string | null
          practice_name?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          account_id?: string | null
          brand_dna_url?: string | null
          budget_target?: number | null
          bundle_social_team_id?: string | null
          campaign_focus?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_reports_completed_at?: string | null
          onboarding_reports_done?: number
          onboarding_reports_error?: string | null
          onboarding_reports_started_at?: string | null
          onboarding_reports_status?: string
          onboarding_reports_total?: number
          parent_account_id?: string | null
          practice_name?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_secrets: {
        Row: {
          social_auth_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          social_auth_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          social_auth_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_account_invite: { Args: { _token: string }; Returns: Json }
      account_id_for_location: {
        Args: { _location_id: string }
        Returns: string
      }
      bundle_social_team_for_user: {
        Args: { _user_id: string }
        Returns: string
      }
      check_and_consume_rate_limit: {
        Args: { _endpoint: string; _max_per_minute?: number; _user_id: string }
        Returns: boolean
      }
      get_invite_preview: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          account_id: string
          account_name: string
          email: string
          expires_at: string
          invited_locations: string[]
        }[]
      }
      is_account_member: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      is_account_owner: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_location_member: {
        Args: { _location_id: string; _user_id: string }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_manager_of: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_role: "owner" | "member"
      app_role: "admin" | "user" | "manager"
      campaign_status:
        | "developing"
        | "scheduled"
        | "active"
        | "ended"
        | "canceled"
      channel_type: "social_media" | "email" | "sms"
      kb_document_type:
        | "platform_rules"
        | "audience_analysis"
        | "market_analysis"
        | "competitive_landscape"
        | "demographics"
        | "brand_guidelines"
        | "custom"
        | "system_prompt"
        | "reputation_sentiment"
        | "social_media"
        | "business_dna"
      kb_scope: "group" | "location"
      platform_type:
        | "facebook"
        | "instagram"
        | "linkedin"
        | "twitter"
        | "mailchimp"
        | "beehive"
        | "internal_email"
        | "internal_sms"
        | "youtube"
        | "tiktok"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_role: ["owner", "member"],
      app_role: ["admin", "user", "manager"],
      campaign_status: [
        "developing",
        "scheduled",
        "active",
        "ended",
        "canceled",
      ],
      channel_type: ["social_media", "email", "sms"],
      kb_document_type: [
        "platform_rules",
        "audience_analysis",
        "market_analysis",
        "competitive_landscape",
        "demographics",
        "brand_guidelines",
        "custom",
        "system_prompt",
        "reputation_sentiment",
        "social_media",
        "business_dna",
      ],
      kb_scope: ["group", "location"],
      platform_type: [
        "facebook",
        "instagram",
        "linkedin",
        "twitter",
        "mailchimp",
        "beehive",
        "internal_email",
        "internal_sms",
        "youtube",
        "tiktok",
      ],
    },
  },
} as const
