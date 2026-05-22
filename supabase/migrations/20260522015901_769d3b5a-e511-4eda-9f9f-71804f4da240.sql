-- Wrapped snapshots: cache computed yearly/semester summaries per user
CREATE TABLE public.wrapped_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period TEXT NOT NULL DEFAULT 'all_time',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_wrapped_user ON public.wrapped_snapshots(user_id, generated_at DESC);

ALTER TABLE public.wrapped_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wrapped_own_select" ON public.wrapped_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "wrapped_own_insert" ON public.wrapped_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wrapped_own_delete" ON public.wrapped_snapshots
  FOR DELETE USING (auth.uid() = user_id);

-- Add semester start to user_profiles for "Wrapped since" date
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS semester_start_date DATE DEFAULT CURRENT_DATE;