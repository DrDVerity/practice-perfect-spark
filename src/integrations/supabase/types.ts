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
          website_url_normalized: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
          website_url_normalized?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
          website_url_normalized?: string | null
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
      approval_requests: {
        Row: {
          account_id: string | null
          campaign_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          request_type: string
          requested_by: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          campaign_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          request_type: string
          requested_by: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          campaign_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          request_type?: string
          requested_by?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_addons: {
        Row: {
          accepted: boolean
          addon_type: string
          campaign_id: string
          created_at: string
          custom_icon: string | null
          custom_label: string | null
          id: string
          notes: string | null
        }
        Insert: {
          accepted?: boolean
          addon_type: string
          campaign_id: string
          created_at?: string
          custom_icon?: string | null
          custom_label?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          accepted?: boolean
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
          distribution_list_id: string | null
          id: string
          platform: Database["public"]["Enums"]["platform_type"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          distribution_list_id?: string | null
          id?: string
          platform: Database["public"]["Enums"]["platform_type"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          distribution_list_id?: string | null
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
      campaign_drip_messages: {
        Row: {
          accepted: boolean
          body: string
          created_at: string
          id: string
          sequence_no: number
          series_id: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          accepted?: boolean
          body?: string
          created_at?: string
          id?: string
          sequence_no: number
          series_id: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          accepted?: boolean
          body?: string
          created_at?: string
          id?: string
          sequence_no?: number
          series_id?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_drip_messages_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "campaign_drip_series"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_drip_series: {
        Row: {
          campaign_id: string
          channel_id: string | null
          channel_type: string
          complete: boolean
          created_at: string
          id: string
          recipient_config: Json
          recipient_mode: string
          series_length: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          channel_id?: string | null
          channel_type: string
          complete?: boolean
          created_at?: string
          id?: string
          recipient_config?: Json
          recipient_mode?: string
          series_length?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          channel_id?: string | null
          channel_type?: string
          complete?: boolean
          created_at?: string
          id?: string
          recipient_config?: Json
          recipient_mode?: string
          series_length?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_drip_series_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_drip_series_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "campaign_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_email_funnel: {
        Row: {
          accepted: boolean
          body_html: string
          campaign_id: string
          created_at: string
          id: string
          order_index: number
          preview_text: string | null
          send_offset_days: number
          subject: string
          updated_at: string
        }
        Insert: {
          accepted?: boolean
          body_html: string
          campaign_id: string
          created_at?: string
          id?: string
          order_index: number
          preview_text?: string | null
          send_offset_days?: number
          subject: string
          updated_at?: string
        }
        Update: {
          accepted?: boolean
          body_html?: string
          campaign_id?: string
          created_at?: string
          id?: string
          order_index?: number
          preview_text?: string | null
          send_offset_days?: number
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_email_funnel_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          account_id: string
          attachments: Json
          body: string
          campaign_id: string | null
          created_at: string
          direction: string
          external_message_id: string | null
          id: string
          in_reply_to: string | null
          metadata: Json
          recipient_address: string
          recipient_type: string
          sender_address: string | null
          sender_display: string | null
          sender_user_id: string | null
          subject: string | null
          type: string
        }
        Insert: {
          account_id: string
          attachments?: Json
          body: string
          campaign_id?: string | null
          created_at?: string
          direction: string
          external_message_id?: string | null
          id?: string
          in_reply_to?: string | null
          metadata?: Json
          recipient_address: string
          recipient_type: string
          sender_address?: string | null
          sender_display?: string | null
          sender_user_id?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          account_id?: string
          attachments?: Json
          body?: string
          campaign_id?: string | null
          created_at?: string
          direction?: string
          external_message_id?: string | null
          id?: string
          in_reply_to?: string | null
          metadata?: Json
          recipient_address?: string
          recipient_type?: string
          sender_address?: string | null
          sender_display?: string | null
          sender_user_id?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
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
          approval_status: string
          article_accepted: boolean
          assets_accepted: Json
          blog_article: string | null
          blog_title: string | null
          content_topic: string | null
          created_at: string
          duration_unit: string | null
          duration_value: number | null
          end_date: string | null
          focus: string | null
          funnel_accepted: boolean
          generation_error: string | null
          generation_status: string | null
          hero_image_url: string | null
          id: string
          landing_page_html: string | null
          landing_page_url: string | null
          location_id: string
          name: string
          plan_inputs_hash: string | null
          plan_version: number
          posts_accepted: boolean
          psychological_approach: string | null
          short_video_url: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          step_plan: Json | null
          strategy: string | null
          strategy_accepted: boolean
          strategy_pdf_url: string | null
          target_audience: string | null
          target_market_refined: string | null
          topic_source: string | null
          updated_at: string
          user_id: string
          youtube_script: string | null
        }
        Insert: {
          approval_status?: string
          article_accepted?: boolean
          assets_accepted?: Json
          blog_article?: string | null
          blog_title?: string | null
          content_topic?: string | null
          created_at?: string
          duration_unit?: string | null
          duration_value?: number | null
          end_date?: string | null
          focus?: string | null
          funnel_accepted?: boolean
          generation_error?: string | null
          generation_status?: string | null
          hero_image_url?: string | null
          id?: string
          landing_page_html?: string | null
          landing_page_url?: string | null
          location_id: string
          name: string
          plan_inputs_hash?: string | null
          plan_version?: number
          posts_accepted?: boolean
          psychological_approach?: string | null
          short_video_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          step_plan?: Json | null
          strategy?: string | null
          strategy_accepted?: boolean
          strategy_pdf_url?: string | null
          target_audience?: string | null
          target_market_refined?: string | null
          topic_source?: string | null
          updated_at?: string
          user_id: string
          youtube_script?: string | null
        }
        Update: {
          approval_status?: string
          article_accepted?: boolean
          assets_accepted?: Json
          blog_article?: string | null
          blog_title?: string | null
          content_topic?: string | null
          created_at?: string
          duration_unit?: string | null
          duration_value?: number | null
          end_date?: string | null
          focus?: string | null
          funnel_accepted?: boolean
          generation_error?: string | null
          generation_status?: string | null
          hero_image_url?: string | null
          id?: string
          landing_page_html?: string | null
          landing_page_url?: string | null
          location_id?: string
          name?: string
          plan_inputs_hash?: string | null
          plan_version?: number
          posts_accepted?: boolean
          psychological_approach?: string | null
          short_video_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          step_plan?: Json | null
          strategy?: string | null
          strategy_accepted?: boolean
          strategy_pdf_url?: string | null
          target_audience?: string | null
          target_market_refined?: string | null
          topic_source?: string | null
          updated_at?: string
          user_id?: string
          youtube_script?: string | null
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
          accepted: boolean
          bundle_social_post_id: string | null
          campaign_channel_id: string
          carousel_slides: Json | null
          created_at: string
          id: string
          image_url: string | null
          interactive_payload: Json | null
          post_format: string
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
          accepted?: boolean
          bundle_social_post_id?: string | null
          campaign_channel_id: string
          carousel_slides?: Json | null
          created_at?: string
          id?: string
          image_url?: string | null
          interactive_payload?: Json | null
          post_format?: string
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
          accepted?: boolean
          bundle_social_post_id?: string | null
          campaign_channel_id?: string
          carousel_slides?: Json | null
          created_at?: string
          id?: string
          image_url?: string | null
          interactive_payload?: Json | null
          post_format?: string
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
      email_distribution_lists: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          name: string
          pms_query: string | null
          row_count: number
          source: string
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          name: string
          pms_query?: string | null
          row_count?: number
          source: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          name?: string
          pms_query?: string | null
          row_count?: number
          source?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      landing_page_leads: {
        Row: {
          account_id: string
          campaign_id: string
          created_at: string
          email: string | null
          id: string
          message: string | null
          name: string | null
          phone: string | null
          source_url: string | null
        }
        Insert: {
          account_id: string
          campaign_id: string
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          source_url?: string | null
        }
        Update: {
          account_id?: string
          campaign_id?: string
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
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
          plan_tier: string | null
          practice_name: string | null
          target_audience: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          website_url: string | null
          website_url_normalized: string | null
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
          plan_tier?: string | null
          practice_name?: string | null
          target_audience?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
          website_url_normalized?: string | null
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
          plan_tier?: string | null
          practice_name?: string | null
          target_audience?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
          website_url_normalized?: string | null
        }
        Relationships: []
      }
      prospect_accounts: {
        Row: {
          campaign_focus: string | null
          converted_user_id: string | null
          created_at: string
          email: string
          error: string | null
          id: string
          practice_name: string | null
          status: string
          target_audience: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          campaign_focus?: string | null
          converted_user_id?: string | null
          created_at?: string
          email: string
          error?: string | null
          id?: string
          practice_name?: string | null
          status?: string
          target_audience?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          campaign_focus?: string | null
          converted_user_id?: string | null
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          practice_name?: string | null
          status?: string
          target_audience?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      prospect_campaigns: {
        Row: {
          blog_html: string | null
          blog_title: string | null
          created_at: string
          email_funnel: Json
          hero_image_url: string | null
          id: string
          illustrations: Json
          posts: Json
          prospect_id: string
          updated_at: string
        }
        Insert: {
          blog_html?: string | null
          blog_title?: string | null
          created_at?: string
          email_funnel?: Json
          hero_image_url?: string | null
          id?: string
          illustrations?: Json
          posts?: Json
          prospect_id: string
          updated_at?: string
        }
        Update: {
          blog_html?: string | null
          blog_title?: string | null
          created_at?: string
          email_funnel?: Json
          hero_image_url?: string | null
          id?: string
          illustrations?: Json
          posts?: Json
          prospect_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_campaigns_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_reports: {
        Row: {
          content: string
          created_at: string
          doc_type: string
          id: string
          metadata: Json
          prospect_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          doc_type: string
          id?: string
          metadata?: Json
          prospect_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          doc_type?: string
          id?: string
          metadata?: Json
          prospect_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_reports_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriber_nurture_emails: {
        Row: {
          cancelled_at: string | null
          created_at: string
          email: string
          error: string | null
          id: string
          send_at: string
          sent_at: string | null
          template_key: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          email: string
          error?: string | null
          id?: string
          send_at: string
          sent_at?: string | null
          template_key: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          send_at?: string
          sent_at?: string | null
          template_key?: string
          user_id?: string
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
      normalize_website_url: { Args: { _url: string }; Returns: string }
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
