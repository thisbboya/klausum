
CREATE TABLE public.cornell_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  material_id uuid,
  title text NOT NULL,
  subject text DEFAULT 'General',
  cue_column text DEFAULT '',
  notes_column text DEFAULT '',
  summary text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.cornell_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own cornell_notes" ON public.cornell_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.mind_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  material_id uuid,
  title text NOT NULL,
  subject text DEFAULT 'General',
  nodes jsonb DEFAULT '[]'::jsonb,
  edges jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.mind_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own mind_maps" ON public.mind_maps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  material_id uuid,
  title text NOT NULL,
  subject text DEFAULT 'General',
  difficulty text DEFAULT 'medium',
  quiz_type text DEFAULT 'mcq',
  questions jsonb DEFAULT '[]'::jsonb,
  question_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own quizzes" ON public.quizzes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_id uuid NOT NULL,
  answers jsonb DEFAULT '[]'::jsonb,
  score integer DEFAULT 0,
  total integer DEFAULT 0,
  bloom_breakdown jsonb DEFAULT '{}'::jsonb,
  duration_seconds integer DEFAULT 0,
  completed_at timestamptz DEFAULT now()
);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own quiz_attempts" ON public.quiz_attempts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.knowledge_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  subject text DEFAULT 'General',
  bloom_level integer DEFAULT 1,
  severity text DEFAULT 'moderate',
  source text,
  source_id uuid,
  confidence integer DEFAULT 30,
  status text DEFAULT 'open',
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.knowledge_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own gaps" ON public.knowledge_gaps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_gaps_user_status ON public.knowledge_gaps(user_id, status);
CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts(user_id, completed_at DESC);
