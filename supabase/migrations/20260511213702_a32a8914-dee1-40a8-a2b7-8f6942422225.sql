CREATE TABLE public.code_snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'python',
  code TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.code_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own snippets" ON public.code_snippets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_code_snippets_user ON public.code_snippets(user_id, updated_at DESC);
CREATE OR REPLACE FUNCTION public.touch_code_snippets() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_code_snippets_updated BEFORE UPDATE ON public.code_snippets FOR EACH ROW EXECUTE FUNCTION public.touch_code_snippets();