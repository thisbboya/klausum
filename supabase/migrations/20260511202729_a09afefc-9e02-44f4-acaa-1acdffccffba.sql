ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS is_ready boolean DEFAULT false;

DO $$ BEGIN
  CREATE POLICY "Update own membership" ON public.room_members FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.room_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  display_name text,
  body text NOT NULL,
  upvotes integer DEFAULT 0,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.room_questions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "View room questions" ON public.room_questions FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Post room questions" ON public.room_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Update room questions" ON public.room_questions FOR UPDATE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Delete own questions" ON public.room_questions FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_questions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;