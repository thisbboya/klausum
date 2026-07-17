-- User-defined courses (CourieX-style folders with icon + color)

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT '📚',
  color text NOT NULL DEFAULT '#1CB0F6',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own courses" ON public.courses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
