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
      flashcard_decks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          material_id: string | null
          subject: string | null
          title: string
          total_cards: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          material_id?: string | null
          subject?: string | null
          title: string
          total_cards?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          material_id?: string | null
          subject?: string | null
          title?: string
          total_cards?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_decks_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "study_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_reviews: {
        Row: {
          card_id: string
          id: number
          rating: number
          reviewed_at: string | null
          stability_after: number | null
          stability_before: number | null
          user_id: string
        }
        Insert: {
          card_id: string
          id?: number
          rating: number
          reviewed_at?: string | null
          stability_after?: number | null
          stability_before?: number | null
          user_id: string
        }
        Update: {
          card_id?: string
          id?: number
          rating?: number
          reviewed_at?: string | null
          stability_after?: number | null
          stability_before?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          bloom_level: number | null
          created_at: string | null
          deck_id: string
          front: string
          fsrs_difficulty: number | null
          fsrs_lapses: number | null
          fsrs_repetitions: number | null
          fsrs_retrievability: number | null
          fsrs_stability: number | null
          fsrs_state: string | null
          hint: string | null
          id: string
          last_rating: number | null
          last_review_date: string | null
          next_review_date: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          back: string
          bloom_level?: number | null
          created_at?: string | null
          deck_id: string
          front: string
          fsrs_difficulty?: number | null
          fsrs_lapses?: number | null
          fsrs_repetitions?: number | null
          fsrs_retrievability?: number | null
          fsrs_stability?: number | null
          fsrs_state?: string | null
          hint?: string | null
          id?: string
          last_rating?: number | null
          last_review_date?: string | null
          next_review_date?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          back?: string
          bloom_level?: number | null
          created_at?: string | null
          deck_id?: string
          front?: string
          fsrs_difficulty?: number | null
          fsrs_lapses?: number | null
          fsrs_repetitions?: number | null
          fsrs_retrievability?: number | null
          fsrs_stability?: number | null
          fsrs_state?: string | null
          hint?: string | null
          id?: string
          last_rating?: number | null
          last_review_date?: string | null
          next_review_date?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      study_materials: {
        Row: {
          adapted_auditory: string | null
          adapted_kinesthetic: string | null
          adapted_reading: string | null
          adapted_visual: string | null
          ai_summary: string | null
          created_at: string | null
          estimated_read_minutes: number | null
          file_name: string | null
          file_type: string | null
          id: string
          key_concepts: Json | null
          level: string | null
          original_content: string
          processing_error: string | null
          processing_status: string | null
          subject: string
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
          word_count: number | null
        }
        Insert: {
          adapted_auditory?: string | null
          adapted_kinesthetic?: string | null
          adapted_reading?: string | null
          adapted_visual?: string | null
          ai_summary?: string | null
          created_at?: string | null
          estimated_read_minutes?: number | null
          file_name?: string | null
          file_type?: string | null
          id?: string
          key_concepts?: Json | null
          level?: string | null
          original_content: string
          processing_error?: string | null
          processing_status?: string | null
          subject?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
          word_count?: number | null
        }
        Update: {
          adapted_auditory?: string | null
          adapted_kinesthetic?: string | null
          adapted_reading?: string | null
          adapted_visual?: string | null
          ai_summary?: string | null
          created_at?: string | null
          estimated_read_minutes?: number | null
          file_name?: string | null
          file_type?: string | null
          id?: string
          key_concepts?: Json | null
          level?: string | null
          original_content?: string
          processing_error?: string | null
          processing_status?: string | null
          subject?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      tutor_sessions: {
        Row: {
          created_at: string | null
          id: string
          material_id: string | null
          message_count: number | null
          messages: Json | null
          mode: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          message_count?: number | null
          messages?: Json | null
          mode?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          message_count?: number | null
          messages?: Json | null
          mode?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_sessions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "study_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          auditory_score: number | null
          avatar_url: string | null
          country: string | null
          created_at: string | null
          curriculum: string | null
          daily_goal_minutes: number | null
          dark_mode: boolean | null
          field_of_study: string | null
          full_name: string
          id: string
          kinesthetic_score: number | null
          last_study_date: string | null
          level: string | null
          longest_streak: number | null
          onboarding_completed: boolean | null
          preferred_session_minutes: number | null
          primary_style: string | null
          programme: string | null
          reading_score: number | null
          school: string | null
          secondary_style: string | null
          streak_days: number | null
          updated_at: string | null
          vark_completed: boolean | null
          visual_score: number | null
          xp_total: number | null
        }
        Insert: {
          auditory_score?: number | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          curriculum?: string | null
          daily_goal_minutes?: number | null
          dark_mode?: boolean | null
          field_of_study?: string | null
          full_name?: string
          id: string
          kinesthetic_score?: number | null
          last_study_date?: string | null
          level?: string | null
          longest_streak?: number | null
          onboarding_completed?: boolean | null
          preferred_session_minutes?: number | null
          primary_style?: string | null
          programme?: string | null
          reading_score?: number | null
          school?: string | null
          secondary_style?: string | null
          streak_days?: number | null
          updated_at?: string | null
          vark_completed?: boolean | null
          visual_score?: number | null
          xp_total?: number | null
        }
        Update: {
          auditory_score?: number | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          curriculum?: string | null
          daily_goal_minutes?: number | null
          dark_mode?: boolean | null
          field_of_study?: string | null
          full_name?: string
          id?: string
          kinesthetic_score?: number | null
          last_study_date?: string | null
          level?: string | null
          longest_streak?: number | null
          onboarding_completed?: boolean | null
          preferred_session_minutes?: number | null
          primary_style?: string | null
          programme?: string | null
          reading_score?: number | null
          school?: string | null
          secondary_style?: string | null
          streak_days?: number | null
          updated_at?: string | null
          vark_completed?: boolean | null
          visual_score?: number | null
          xp_total?: number | null
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          user_id: string
          xp_amount: number
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          user_id: string
          xp_amount: number
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          user_id?: string
          xp_amount?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_xp: { Args: { _amount: number }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
