-- A.1: citations column on material_chat_messages
ALTER TABLE public.material_chat_messages
  ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT '[]'::jsonb;

-- B.4: Question Bank
CREATE TABLE IF NOT EXISTS public.question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  subject TEXT,
  source TEXT NOT NULL CHECK (source IN ('snap_solve','quiz_wrong','manual','tutor')),
  image_url TEXT,
  steps JSONB DEFAULT '[]'::jsonb,
  reviewed_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qb_owner_all" ON public.question_bank FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_qb_user_created ON public.question_bank (user_id, created_at DESC);