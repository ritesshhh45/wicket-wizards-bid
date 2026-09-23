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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auction_events: {
        Row: {
          amount: number | null
          auction_session_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          player_id: string | null
          previous_amount: number | null
          team_id: string | null
          tournament_id: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          auction_session_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          player_id?: string | null
          previous_amount?: number | null
          team_id?: string | null
          tournament_id: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          auction_session_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          player_id?: string | null
          previous_amount?: number | null
          team_id?: string | null
          tournament_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_events_auction_session_id_fkey"
            columns: ["auction_session_id"]
            isOneToOne: false
            referencedRelation: "auction_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          current_player_id: string | null
          ended_at: string | null
          id: string
          name: string
          paused_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"]
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_player_id?: string | null
          ended_at?: string | null
          id?: string
          name?: string
          paused_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_player_id?: string | null
          ended_at?: string | null
          id?: string
          name?: string
          paused_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_sessions_current_player_id_fkey"
            columns: ["current_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_sessions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          active: boolean
          amount: number
          auction_session_id: string | null
          created_at: string
          id: string
          player_id: string
          team_id: string
          tournament_id: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          amount: number
          auction_session_id?: string | null
          created_at?: string
          id?: string
          player_id: string
          team_id: string
          tournament_id: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          auction_session_id?: string | null
          created_at?: string
          id?: string
          player_id?: string
          team_id?: string
          tournament_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_session_id_fkey"
            columns: ["auction_session_id"]
            isOneToOne: false
            referencedRelation: "auction_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          title: string
          tournament_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title: string
          tournament_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title?: string
          tournament_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          id: string
          screenshot_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          tournament_id: string
          utr_number: string | null
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          id?: string
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tournament_id: string
          utr_number?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          id?: string
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tournament_id?: string
          utr_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          auction_round: number
          base_price: number
          batting_style: string | null
          bowling_style: string | null
          city: string | null
          created_at: string
          current_bid: number | null
          current_bid_team_id: string | null
          grade: string | null
          id: string
          is_fixed: boolean
          mobile: string | null
          name: string
          photo_url: string | null
          previous_team: string | null
          queue_order: number
          role: string
          sold_price: number | null
          sold_to_team_id: string | null
          stats: Json
          status: Database["public"]["Enums"]["player_status"]
          tournament_id: string
        }
        Insert: {
          auction_round?: number
          base_price?: number
          batting_style?: string | null
          bowling_style?: string | null
          city?: string | null
          created_at?: string
          current_bid?: number | null
          current_bid_team_id?: string | null
          grade?: string | null
          id?: string
          is_fixed?: boolean
          mobile?: string | null
          name: string
          photo_url?: string | null
          previous_team?: string | null
          queue_order?: number
          role?: string
          sold_price?: number | null
          sold_to_team_id?: string | null
          stats?: Json
          status?: Database["public"]["Enums"]["player_status"]
          tournament_id: string
        }
        Update: {
          auction_round?: number
          base_price?: number
          batting_style?: string | null
          bowling_style?: string | null
          city?: string | null
          created_at?: string
          current_bid?: number | null
          current_bid_team_id?: string | null
          grade?: string | null
          id?: string
          is_fixed?: boolean
          mobile?: string | null
          name?: string
          photo_url?: string | null
          previous_team?: string | null
          queue_order?: number
          role?: string
          sold_price?: number | null
          sold_to_team_id?: string | null
          stats?: Json
          status?: Database["public"]["Enums"]["player_status"]
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_current_bid_team_id_fkey"
            columns: ["current_bid_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_sold_to_team_id_fkey"
            columns: ["sold_to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          photo_url: string | null
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          name?: string
          phone?: string | null
          photo_url?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
        }
        Relationships: []
      }
      team_transactions: {
        Row: {
          amount: number
          auction_session_id: string | null
          created_at: string
          description: string | null
          id: string
          player_id: string | null
          team_id: string
          tournament_id: string
          type: string
        }
        Insert: {
          amount?: number
          auction_session_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          player_id?: string | null
          team_id: string
          tournament_id: string
          type: string
        }
        Update: {
          amount?: number
          auction_session_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          player_id?: string | null
          team_id?: string
          tournament_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_transactions_auction_session_id_fkey"
            columns: ["auction_session_id"]
            isOneToOne: false
            referencedRelation: "auction_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transactions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_transactions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          captain_claimed_at: string | null
          captain_name: string | null
          captain_photo_url: string | null
          created_at: string
          id: string
          invite_token: string | null
          logo_url: string | null
          name: string
          owner_name: string | null
          owner_user_id: string | null
          remaining_budget: number
          total_budget: number
          tournament_id: string
        }
        Insert: {
          captain_claimed_at?: string | null
          captain_name?: string | null
          captain_photo_url?: string | null
          created_at?: string
          id?: string
          invite_token?: string | null
          logo_url?: string | null
          name: string
          owner_name?: string | null
          owner_user_id?: string | null
          remaining_budget?: number
          total_budget?: number
          tournament_id: string
        }
        Update: {
          captain_claimed_at?: string | null
          captain_name?: string | null
          captain_photo_url?: string | null
          created_at?: string
          id?: string
          invite_token?: string | null
          logo_url?: string | null
          name?: string
          owner_name?: string | null
          owner_user_id?: string | null
          remaining_budget?: number
          total_budget?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          auction_date: string | null
          banner_url: string | null
          base_price_tiers: Json
          bid_increment_rules: Json
          categories: Json
          category_limits: Json
          config_locked: boolean
          created_at: string
          current_round: number
          id: string
          min_max_squad: Json
          name: string
          num_teams: number
          owner_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          proxy_bidding_enabled: boolean
          status: Database["public"]["Enums"]["tournament_status"]
          total_budget_per_team: number
          tournament_type: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          auction_date?: string | null
          banner_url?: string | null
          base_price_tiers?: Json
          bid_increment_rules?: Json
          categories?: Json
          category_limits?: Json
          config_locked?: boolean
          created_at?: string
          current_round?: number
          id?: string
          min_max_squad?: Json
          name: string
          num_teams?: number
          owner_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          proxy_bidding_enabled?: boolean
          status?: Database["public"]["Enums"]["tournament_status"]
          total_budget_per_team?: number
          tournament_type?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          auction_date?: string | null
          banner_url?: string | null
          base_price_tiers?: Json
          bid_increment_rules?: Json
          categories?: Json
          category_limits?: Json
          config_locked?: boolean
          created_at?: string
          current_round?: number
          id?: string
          min_max_squad?: Json
          name?: string
          num_teams?: number
          owner_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          proxy_bidding_enabled?: boolean
          status?: Database["public"]["Enums"]["tournament_status"]
          total_budget_per_team?: number
          tournament_type?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      claim_team_invite: { Args: { p_token: string }; Returns: Json }
      complete_auction: { Args: { p_session_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      load_next_player: {
        Args: { p_player_id: string; p_session_id: string }
        Returns: Json
      }
      log_event: {
        Args: {
          _amount: number
          _meta: Json
          _p: string
          _prev: number
          _s: string
          _t: string
          _team: string
          _type: string
        }
        Returns: undefined
      }
      mark_player_sold: { Args: { p_player_id: string }; Returns: Json }
      mark_player_unsold: { Args: { p_player_id: string }; Returns: Json }
      min_base_price: { Args: { _tournament: string }; Returns: number }
      next_increment: {
        Args: { _current: number; _tournament: string }
        Returns: number
      }
      owns_tournament: { Args: { _t: string }; Returns: boolean }
      pause_auction: {
        Args: { p_resume: boolean; p_session_id: string }
        Returns: Json
      }
      place_bid: {
        Args: { p_player_id: string; p_team_id: string }
        Returns: Json
      }
      reauction_player: { Args: { p_player_id: string }; Returns: Json }
      regenerate_team_invite: { Args: { p_team_id: string }; Returns: Json }
      reopen_player: { Args: { p_player_id: string }; Returns: Json }
      review_payment: {
        Args: { p_approve: boolean; p_payment_id: string }
        Returns: Json
      }
      set_fixed_player: {
        Args: { p_player_id: string; p_team_id: string }
        Returns: Json
      }
      start_auction: { Args: { p_session_id: string }; Returns: Json }
      start_reauction_round: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      undo_last_bid: { Args: { p_player_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "super_admin" | "tournament_owner" | "team_owner" | "viewer"
      payment_status: "unpaid" | "pending" | "approved" | "rejected"
      player_status:
        | "pending_approval"
        | "available"
        | "in_auction"
        | "sold"
        | "unsold"
        | "re_auction"
      session_status: "scheduled" | "live" | "paused" | "completed"
      tournament_status:
        | "draft"
        | "pending_payment"
        | "active"
        | "auction_live"
        | "completed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["super_admin", "tournament_owner", "team_owner", "viewer"],
      payment_status: ["unpaid", "pending", "approved", "rejected"],
      player_status: [
        "pending_approval",
        "available",
        "in_auction",
        "sold",
        "unsold",
        "re_auction",
      ],
      session_status: ["scheduled", "live", "paused", "completed"],
      tournament_status: [
        "draft",
        "pending_payment",
        "active",
        "auction_live",
        "completed",
      ],
    },
  },
} as const
