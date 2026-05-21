
CREATE TABLE public.daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  target INTEGER NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  reward_xp INTEGER NOT NULL DEFAULT 10,
  reward_gems INTEGER NOT NULL DEFAULT 5,
  completed BOOLEAN NOT NULL DEFAULT false,
  claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_date, key)
);
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quests_own_select" ON public.daily_quests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "quests_own_insert" ON public.daily_quests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quests_own_update" ON public.daily_quests FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX idx_daily_quests_user_date ON public.daily_quests(user_id, quest_date);

CREATE TABLE public.chest_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tier TEXT NOT NULL,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  reward_gems INTEGER NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chest_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chests_own_select" ON public.chest_openings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chests_own_insert" ON public.chest_openings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Atomic gem grant
CREATE OR REPLACE FUNCTION public.grant_rewards(_xp INTEGER, _gems INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF _xp IS NULL OR _xp < 0 OR _xp > 1000 THEN _xp := 0; END IF;
  IF _gems IS NULL OR _gems < 0 OR _gems > 1000 THEN _gems := 0; END IF;
  UPDATE public.user_profiles
  SET xp_total = COALESCE(xp_total, 0) + _xp,
      gems = COALESCE(gems, 0) + _gems,
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;
