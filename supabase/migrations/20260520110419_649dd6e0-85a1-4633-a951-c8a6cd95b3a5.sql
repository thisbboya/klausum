ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS streak_freezes INTEGER NOT NULL DEFAULT 2;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS streak_freeze_used_date DATE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS sounds_enabled BOOLEAN NOT NULL DEFAULT true;