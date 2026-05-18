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
      challenge_completions: {
        Row: {
          challenge_key: string
          completed_at: string | null
          id: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          challenge_key: string
          completed_at?: string | null
          id?: string
          user_id: string
          xp_awarded: number
        }
        Update: {
          challenge_key?: string
          completed_at?: string | null
          id?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      code_snippets: {
        Row: {
          code: string
          created_at: string
          id: string
          is_favorite: boolean
          language: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          language?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          language?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cornell_notes: {
        Row: {
          created_at: string | null
          cue_column: string | null
          id: string
          material_id: string | null
          notes_column: string | null
          subject: string | null
          summary: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          cue_column?: string | null
          id?: string
          material_id?: string | null
          notes_column?: string | null
          subject?: string | null
          summary?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          cue_column?: string | null
          id?: string
          material_id?: string | null
          notes_column?: string | null
          subject?: string | null
          summary?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          check_date: string
          created_at: string | null
          energy: string
          id: string
          mood: number
          user_id: string
        }
        Insert: {
          check_date?: string
          created_at?: string | null
          energy: string
          id?: string
          mood: number
          user_id: string
        }
        Update: {
          check_date?: string
          created_at?: string | null
          energy?: string
          id?: string
          mood?: number
          user_id?: string
        }
        Relationships: []
      }
      exam_countdowns: {
        Row: {
          created_at: string | null
          current_readiness: number | null
          exam_date: string
          exam_name: string
          exam_type: string | null
          id: string
          notes: string | null
          subject: string | null
          target_grade: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_readiness?: number | null
          exam_date: string
          exam_name: string
          exam_type?: string | null
          id?: string
          notes?: string | null
          subject?: string | null
          target_grade?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_readiness?: number | null
          exam_date?: string
          exam_name?: string
          exam_type?: string | null
          id?: string
          notes?: string | null
          subject?: string | null
          target_grade?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      focus_sessions: {
        Row: {
          actual_minutes: number | null
          completed: boolean | null
          created_at: string | null
          ended_at: string | null
          id: string
          material_id: string | null
          planned_minutes: number | null
          session_type: string | null
          started_at: string | null
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          completed?: boolean | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          material_id?: string | null
          planned_minutes?: number | null
          session_type?: string | null
          started_at?: string | null
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          completed?: boolean | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          material_id?: string | null
          planned_minutes?: number | null
          session_type?: string | null
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "study_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      formulas: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_favorite: boolean | null
          latex: string
          name: string
          subject: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
          variables: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          latex: string
          name: string
          subject?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
          variables?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          latex?: string
          name?: string
          subject?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
          variables?: Json | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string | null
          id: string
          requester_id: string
          status: string | null
        }
        Insert: {
          addressee_id: string
          created_at?: string | null
          id?: string
          requester_id: string
          status?: string | null
        }
        Update: {
          addressee_id?: string
          created_at?: string | null
          id?: string
          requester_id?: string
          status?: string | null
        }
        Relationships: []
      }
      knowledge_gaps: {
        Row: {
          bloom_level: number | null
          confidence: number | null
          created_at: string | null
          hit_count: number
          id: string
          resolved_at: string | null
          severity: string | null
          source: string | null
          source_id: string | null
          status: string | null
          subject: string | null
          topic: string
          user_id: string
        }
        Insert: {
          bloom_level?: number | null
          confidence?: number | null
          created_at?: string | null
          hit_count?: number
          id?: string
          resolved_at?: string | null
          severity?: string | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          subject?: string | null
          topic: string
          user_id: string
        }
        Update: {
          bloom_level?: number | null
          confidence?: number | null
          created_at?: string | null
          hit_count?: number
          id?: string
          resolved_at?: string | null
          severity?: string | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          subject?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      leaderboard_weekly: {
        Row: {
          id: string
          user_id: string
          week_start: string
          xp_this_week: number | null
        }
        Insert: {
          id?: string
          user_id: string
          week_start: string
          xp_this_week?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          week_start?: string
          xp_this_week?: number | null
        }
        Relationships: []
      }
      mind_maps: {
        Row: {
          created_at: string | null
          edges: Json | null
          id: string
          material_id: string | null
          nodes: Json | null
          subject: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          edges?: Json | null
          id?: string
          material_id?: string | null
          nodes?: Json | null
          subject?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          edges?: Json | null
          id?: string
          material_id?: string | null
          nodes?: Json | null
          subject?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      monthly_usage: {
        Row: {
          ai_messages_used: number | null
          id: string
          month_year: string
          updated_at: string | null
          user_id: string
          youtube_videos_used: number | null
        }
        Insert: {
          ai_messages_used?: number | null
          id?: string
          month_year: string
          updated_at?: string | null
          user_id: string
          youtube_videos_used?: number | null
        }
        Update: {
          ai_messages_used?: number | null
          id?: string
          month_year?: string
          updated_at?: string | null
          user_id?: string
          youtube_videos_used?: number | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json | null
          bloom_breakdown: Json | null
          completed_at: string | null
          duration_seconds: number | null
          id: string
          quiz_id: string
          score: number | null
          total: number | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          bloom_breakdown?: Json | null
          completed_at?: string | null
          duration_seconds?: number | null
          id?: string
          quiz_id: string
          score?: number | null
          total?: number | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          bloom_breakdown?: Json | null
          completed_at?: string | null
          duration_seconds?: number | null
          id?: string
          quiz_id?: string
          score?: number | null
          total?: number | null
          user_id?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          created_at: string | null
          difficulty: string | null
          id: string
          material_id: string | null
          question_count: number | null
          questions: Json | null
          quiz_type: string | null
          subject: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          difficulty?: string | null
          id?: string
          material_id?: string | null
          question_count?: number | null
          questions?: Json | null
          quiz_type?: string | null
          subject?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          difficulty?: string | null
          id?: string
          material_id?: string | null
          question_count?: number | null
          questions?: Json | null
          quiz_type?: string | null
          subject?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      room_members: {
        Row: {
          display_name: string | null
          id: string
          is_ready: boolean | null
          joined_at: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          display_name?: string | null
          id?: string
          is_ready?: boolean | null
          joined_at?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          display_name?: string | null
          id?: string
          is_ready?: boolean | null
          joined_at?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          body: string
          created_at: string | null
          display_name: string | null
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_questions: {
        Row: {
          body: string
          created_at: string | null
          display_name: string | null
          id: string
          resolved: boolean | null
          room_id: string
          upvotes: number | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          resolved?: boolean | null
          room_id: string
          upvotes?: number | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          resolved?: boolean | null
          room_id?: string
          upvotes?: number | null
          user_id?: string
        }
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          block_type: string | null
          completed: boolean | null
          created_at: string | null
          ends_at: string
          id: string
          material_id: string | null
          notes: string | null
          starts_at: string
          subject: string | null
          title: string
          user_id: string
        }
        Insert: {
          block_type?: string | null
          completed?: boolean | null
          created_at?: string | null
          ends_at: string
          id?: string
          material_id?: string | null
          notes?: string | null
          starts_at: string
          subject?: string | null
          title: string
          user_id: string
        }
        Update: {
          block_type?: string | null
          completed?: boolean | null
          created_at?: string | null
          ends_at?: string
          id?: string
          material_id?: string | null
          notes?: string | null
          starts_at?: string
          subject?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      study_group_members: {
        Row: {
          group_id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          created_at: string | null
          creator_id: string
          description: string | null
          id: string
          invite_code: string | null
          member_count: number | null
          name: string
          subject: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          description?: string | null
          id?: string
          invite_code?: string | null
          member_count?: number | null
          name: string
          subject?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          description?: string | null
          id?: string
          invite_code?: string | null
          member_count?: number | null
          name?: string
          subject?: string | null
        }
        Relationships: []
      }
      study_materials: {
        Row: {
          adapted_auditory: string | null
          adapted_kinesthetic: string | null
          adapted_reading: string | null
          adapted_visual: string | null
          ai_summary: string | null
          bloom_questions: Json | null
          concept_graph: Json | null
          cornell_cue: string | null
          cornell_notes: string | null
          cornell_summary: string | null
          created_at: string | null
          estimated_read_minutes: number | null
          field_category: string | null
          file_name: string | null
          file_type: string | null
          formulas: Json | null
          id: string
          is_stem: boolean | null
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
          bloom_questions?: Json | null
          concept_graph?: Json | null
          cornell_cue?: string | null
          cornell_notes?: string | null
          cornell_summary?: string | null
          created_at?: string | null
          estimated_read_minutes?: number | null
          field_category?: string | null
          file_name?: string | null
          file_type?: string | null
          formulas?: Json | null
          id?: string
          is_stem?: boolean | null
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
          bloom_questions?: Json | null
          concept_graph?: Json | null
          cornell_cue?: string | null
          cornell_notes?: string | null
          cornell_summary?: string | null
          created_at?: string | null
          estimated_read_minutes?: number | null
          field_category?: string | null
          file_name?: string | null
          file_type?: string | null
          formulas?: Json | null
          id?: string
          is_stem?: boolean | null
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
      study_rooms: {
        Row: {
          created_at: string | null
          host_id: string
          id: string
          is_active: boolean | null
          join_code: string | null
          name: string
          pomodoro_state: Json | null
          subject: string | null
        }
        Insert: {
          created_at?: string | null
          host_id: string
          id?: string
          is_active?: boolean | null
          join_code?: string | null
          name: string
          pomodoro_state?: Json | null
          subject?: string | null
        }
        Update: {
          created_at?: string | null
          host_id?: string
          id?: string
          is_active?: boolean | null
          join_code?: string | null
          name?: string
          pomodoro_state?: Json | null
          subject?: string | null
        }
        Relationships: []
      }
      timetable_events: {
        Row: {
          color: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          location: string | null
          start_time: string
          subject_id: string | null
          subject_name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          location?: string | null
          start_time: string
          subject_id?: string | null
          subject_name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          location?: string | null
          start_time?: string
          subject_id?: string | null
          subject_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "timetable_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_subjects: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
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
          available_hours: Json | null
          avatar_url: string | null
          cohort_units: number | null
          companion_id: number | null
          companion_name: string | null
          country: string | null
          created_at: string | null
          curriculum: string | null
          daily_goal_minutes: number | null
          dark_mode: boolean | null
          exam_curriculum: string | null
          field_of_study: string | null
          full_name: string
          handle: string | null
          id: string
          is_day1_pioneer: boolean | null
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
          study_intensity: string | null
          updated_at: string | null
          vark_completed: boolean | null
          visual_score: number | null
          xp_total: number | null
        }
        Insert: {
          auditory_score?: number | null
          available_hours?: Json | null
          avatar_url?: string | null
          cohort_units?: number | null
          companion_id?: number | null
          companion_name?: string | null
          country?: string | null
          created_at?: string | null
          curriculum?: string | null
          daily_goal_minutes?: number | null
          dark_mode?: boolean | null
          exam_curriculum?: string | null
          field_of_study?: string | null
          full_name?: string
          handle?: string | null
          id: string
          is_day1_pioneer?: boolean | null
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
          study_intensity?: string | null
          updated_at?: string | null
          vark_completed?: boolean | null
          visual_score?: number | null
          xp_total?: number | null
        }
        Update: {
          auditory_score?: number | null
          available_hours?: Json | null
          avatar_url?: string | null
          cohort_units?: number | null
          companion_id?: number | null
          companion_name?: string | null
          country?: string | null
          created_at?: string | null
          curriculum?: string | null
          daily_goal_minutes?: number | null
          dark_mode?: boolean | null
          exam_curriculum?: string | null
          field_of_study?: string | null
          full_name?: string
          handle?: string | null
          id?: string
          is_day1_pioneer?: boolean | null
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
          study_intensity?: string | null
          updated_at?: string | null
          vark_completed?: boolean | null
          visual_score?: number | null
          xp_total?: number | null
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
      voice_notes: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          id: string
          key_points: Json | null
          subject: string | null
          summary: string | null
          title: string
          transcript: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          key_points?: Json | null
          subject?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          key_points?: Json | null
          subject?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
          user_id?: string
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
      get_monthly_usage: {
        Args: { p_user_id: string }
        Returns: {
          ai_messages_used: number
          youtube_videos_used: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ai_messages: { Args: { p_user_id: string }; Returns: undefined }
      increment_xp: { Args: { _amount: number }; Returns: undefined }
      increment_youtube_videos: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      update_weekly_leaderboard: {
        Args: { p_user_id: string; p_xp: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
