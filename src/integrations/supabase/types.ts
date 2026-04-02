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
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      channel_credentials: {
        Row: {
          created_at: string
          id: string
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
          campaign_channel_id: string
          created_at: string
          id: string
          image_url: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          text_content: string | null
          title: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          campaign_channel_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          text_content?: string | null
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          campaign_channel_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          text_content?: string | null
          title?: string | null
          updated_at?: string
          video_url?: string | null
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
          content: string
          created_at: string
          doc_type: Database["public"]["Enums"]["kb_document_type"]
          id: string
          metadata: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["kb_document_type"]
          id?: string
          metadata?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["kb_document_type"]
          id?: string
          metadata?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      profiles: {
        Row: {
          brand_dna_url: string | null
          campaign_focus: string | null
          created_at: string
          email: string | null
          id: string
          practice_name: string | null
          social_auth_token: string | null
          target_audience: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          brand_dna_url?: string | null
          campaign_focus?: string | null
          created_at?: string
          email?: string | null
          id?: string
          practice_name?: string | null
          social_auth_token?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          brand_dna_url?: string | null
          campaign_focus?: string | null
          created_at?: string
          email?: string | null
          id?: string
          practice_name?: string | null
          social_auth_token?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_email: { Args: { _email: string }; Returns: boolean }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_manager_of: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
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
      ],
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
