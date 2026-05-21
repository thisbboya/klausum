
-- 1. Add PDF columns to study_materials
ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_storage_url TEXT,
  ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 0;

-- 2. Reading progress (resume reading)
CREATE TABLE IF NOT EXISTS public.reading_progress (
  user_id UUID NOT NULL,
  material_id UUID NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  last_page INTEGER NOT NULL DEFAULT 1,
  total_pages INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, material_id)
);
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own reading progress"
  ON public.reading_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Per-material chat messages
CREATE TABLE IF NOT EXISTS public.material_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  material_id UUID NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','ai')),
  content TEXT NOT NULL,
  page_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.material_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own material chat"
  ON public.material_chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_material_chat_user_material
  ON public.material_chat_messages (user_id, material_id, created_at);

-- 4. Materials storage bucket (private, signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materials',
  'materials',
  false,
  52428800,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 5. Storage policies: users can only access files under their own user-id folder
CREATE POLICY "Users read own material files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own material files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own material files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own material files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);
