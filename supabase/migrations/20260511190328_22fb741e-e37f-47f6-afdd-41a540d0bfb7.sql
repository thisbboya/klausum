
ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS concept_graph jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cornell_cue text,
  ADD COLUMN IF NOT EXISTS cornell_notes text,
  ADD COLUMN IF NOT EXISTS cornell_summary text,
  ADD COLUMN IF NOT EXISTS formulas jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bloom_questions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_stem boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS field_category text;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS exam_curriculum text;

CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  mood int NOT NULL CHECK (mood BETWEEN 1 AND 5),
  energy text NOT NULL CHECK (energy IN ('low','medium','high')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, check_date)
);
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own checkins" ON public.daily_checkins
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.exam_countdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam_name text NOT NULL,
  exam_type text DEFAULT 'general',
  subject text,
  exam_date date NOT NULL,
  target_grade text,
  current_readiness int DEFAULT 0 CHECK (current_readiness BETWEEN 0 AND 100),
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.exam_countdowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own exams" ON public.exam_countdowns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
