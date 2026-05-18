ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS study_intensity TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS available_hours JSONB DEFAULT '[]'::jsonb;