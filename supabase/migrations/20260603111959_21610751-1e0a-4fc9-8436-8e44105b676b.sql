
-- Anara-style reader: notes + AI overview cache
CREATE TABLE public.material_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  material_id UUID NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_notes TO authenticated;
GRANT ALL ON public.material_notes TO service_role;

ALTER TABLE public.material_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own material_notes"
  ON public.material_notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_material_notes_user_material ON public.material_notes(user_id, material_id, created_at DESC);

-- Cache AI overview (summary + TOC) on the material itself.
ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS ai_overview JSONB;
