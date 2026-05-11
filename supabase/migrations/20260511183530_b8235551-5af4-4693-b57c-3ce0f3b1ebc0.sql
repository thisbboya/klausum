
-- ============================================
-- USER PROFILES
-- ============================================
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Student',
  avatar_url TEXT,
  school TEXT,
  country TEXT DEFAULT 'Ghana',
  level TEXT,
  programme TEXT,
  field_of_study TEXT,
  curriculum TEXT DEFAULT 'Ghana_GES',

  -- VARK
  visual_score INTEGER DEFAULT 0,
  auditory_score INTEGER DEFAULT 0,
  reading_score INTEGER DEFAULT 0,
  kinesthetic_score INTEGER DEFAULT 0,
  primary_style TEXT,
  secondary_style TEXT,
  vark_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,

  -- Preferences
  preferred_session_minutes INTEGER DEFAULT 25,
  daily_goal_minutes INTEGER DEFAULT 60,
  dark_mode BOOLEAN DEFAULT TRUE,

  -- Gamification
  xp_total INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_study_date DATE,
  longest_streak INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Student'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Increment XP RPC
CREATE OR REPLACE FUNCTION public.increment_xp(_amount INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_profiles
  SET xp_total = COALESCE(xp_total, 0) + _amount,
      updated_at = NOW()
  WHERE id = auth.uid();
END; $$;

-- ============================================
-- STUDY MATERIALS
-- ============================================
CREATE TABLE public.study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'General',
  level TEXT,
  tags TEXT[] DEFAULT '{}',

  original_content TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,

  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT,

  adapted_visual TEXT,
  adapted_auditory TEXT,
  adapted_reading TEXT,
  adapted_kinesthetic TEXT,

  key_concepts JSONB DEFAULT '[]'::jsonb,
  ai_summary TEXT,

  word_count INTEGER,
  estimated_read_minutes INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own materials" ON public.study_materials FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_materials_user_created ON public.study_materials(user_id, created_at DESC);

-- ============================================
-- FLASHCARD DECKS
-- ============================================
CREATE TABLE public.flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.study_materials(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  total_cards INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own decks" ON public.flashcard_decks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FLASHCARDS (FSRS-5)
-- ============================================
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  hint TEXT,
  bloom_level INTEGER DEFAULT 1 CHECK (bloom_level BETWEEN 1 AND 6),
  tags TEXT[] DEFAULT '{}',

  -- FSRS-5
  fsrs_stability FLOAT DEFAULT 0,
  fsrs_difficulty FLOAT DEFAULT 5,
  fsrs_retrievability FLOAT DEFAULT 0,
  fsrs_repetitions INTEGER DEFAULT 0,
  fsrs_lapses INTEGER DEFAULT 0,
  fsrs_state TEXT DEFAULT 'new' CHECK (fsrs_state IN ('new','learning','review','relearning')),
  next_review_date DATE DEFAULT CURRENT_DATE,
  last_review_date DATE,
  last_rating INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own flashcards" ON public.flashcards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_flashcards_due ON public.flashcards(user_id, next_review_date);

-- ============================================
-- FLASHCARD REVIEWS
-- ============================================
CREATE TABLE public.flashcard_reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  stability_before FLOAT,
  stability_after FLOAT
);
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own reviews" ON public.flashcard_reviews FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TUTOR SESSIONS
-- ============================================
CREATE TABLE public.tutor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.study_materials(id) ON DELETE SET NULL,
  title TEXT DEFAULT 'New conversation',
  mode TEXT DEFAULT 'standard' CHECK (mode IN ('standard','socratic')),
  messages JSONB DEFAULT '[]'::jsonb,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tutor_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own sessions" ON public.tutor_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- XP EVENTS
-- ============================================
CREATE TABLE public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  xp_amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own xp" ON public.xp_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
