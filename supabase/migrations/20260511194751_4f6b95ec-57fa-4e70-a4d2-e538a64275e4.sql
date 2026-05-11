
CREATE TABLE public.formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  latex text NOT NULL,
  subject text DEFAULT 'General',
  category text DEFAULT 'general',
  description text,
  variables jsonb DEFAULT '[]'::jsonb,
  tags text[] DEFAULT '{}',
  is_favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own formulas" ON public.formulas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_formulas_user ON public.formulas(user_id);

CREATE TABLE public.schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  subject text DEFAULT 'General',
  block_type text DEFAULT 'study',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  material_id uuid,
  notes text,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own schedule" ON public.schedule_blocks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_schedule_user_starts ON public.schedule_blocks(user_id, starts_at);
