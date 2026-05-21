
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS hearts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS hearts_last_refill TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS gems INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_hearts_range CHECK (hearts >= 0 AND hearts <= 5);
