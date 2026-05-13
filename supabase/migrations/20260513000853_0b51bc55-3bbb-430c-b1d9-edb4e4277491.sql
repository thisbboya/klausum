
-- Profile additions
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS companion_id INTEGER DEFAULT 1;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS companion_name TEXT DEFAULT 'KOJO';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS cohort_units INTEGER DEFAULT 0;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_day1_pioneer BOOLEAN DEFAULT FALSE;

-- Allow signed-in users to search basic public profile fields (for friends search).
-- Existing "Users view own profile" stays; we add a permissive read for discovery.
DO $$ BEGIN
  CREATE POLICY "Authenticated can search profiles"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Focus sessions
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  material_id UUID REFERENCES public.study_materials(id) ON DELETE SET NULL,
  session_type TEXT DEFAULT 'review',
  planned_minutes INTEGER DEFAULT 0,
  actual_minutes INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own focus sessions" ON public.focus_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Monthly usage
CREATE TABLE IF NOT EXISTS public.monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month_year TEXT NOT NULL,
  ai_messages_used INTEGER DEFAULT 0,
  youtube_videos_used INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month_year)
);
ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own usage" ON public.monthly_usage
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Timetable subjects
CREATE TABLE IF NOT EXISTS public.timetable_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#F4A300',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.timetable_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own subjects" ON public.timetable_subjects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Timetable events
CREATE TABLE IF NOT EXISTS public.timetable_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject_id UUID REFERENCES public.timetable_subjects(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  color TEXT DEFAULT '#F4A300',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.timetable_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own timetable" ON public.timetable_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  addressee_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users insert own friend requests" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users update own friendships" ON public.friendships
  FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users delete own friendships" ON public.friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Study groups + members (avoid recursive policies by using a SECURITY DEFINER helper)
CREATE TABLE IF NOT EXISTS public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  invite_code TEXT UNIQUE DEFAULT UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)),
  member_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.study_group_members (
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

CREATE POLICY "Members view groups" ON public.study_groups
  FOR SELECT USING (public.is_group_member(id, auth.uid()) OR creator_id = auth.uid());
CREATE POLICY "Anyone creates a group" ON public.study_groups
  FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creator updates group" ON public.study_groups
  FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creator deletes group" ON public.study_groups
  FOR DELETE USING (auth.uid() = creator_id);

CREATE POLICY "View group members" ON public.study_group_members
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Join group" ON public.study_group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Leave group" ON public.study_group_members
  FOR DELETE USING (auth.uid() = user_id);

-- Weekly leaderboard
CREATE TABLE IF NOT EXISTS public.leaderboard_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  xp_this_week INTEGER DEFAULT 0,
  UNIQUE(user_id, week_start)
);
ALTER TABLE public.leaderboard_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view leaderboard" ON public.leaderboard_weekly
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users own leaderboard row" ON public.leaderboard_weekly
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Challenge completions
CREATE TABLE IF NOT EXISTS public.challenge_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  challenge_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  xp_awarded INTEGER NOT NULL,
  UNIQUE(user_id, challenge_key)
);
ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own completions" ON public.challenge_completions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_monthly_usage(p_user_id UUID)
RETURNS TABLE(ai_messages_used INT, youtube_videos_used INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT COALESCE(mu.ai_messages_used, 0), COALESCE(mu.youtube_videos_used, 0)
    FROM public.monthly_usage mu
    WHERE mu.user_id = p_user_id
      AND mu.month_year = TO_CHAR(NOW(), 'YYYY-MM');
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_ai_messages(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.monthly_usage (user_id, month_year, ai_messages_used)
  VALUES (p_user_id, TO_CHAR(NOW(), 'YYYY-MM'), 1)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET ai_messages_used = public.monthly_usage.ai_messages_used + 1, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_youtube_videos(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.monthly_usage (user_id, month_year, youtube_videos_used)
  VALUES (p_user_id, TO_CHAR(NOW(), 'YYYY-MM'), 1)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET youtube_videos_used = public.monthly_usage.youtube_videos_used + 1, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_weekly_leaderboard(p_user_id UUID, p_xp INTEGER)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_week_start DATE := DATE_TRUNC('week', NOW())::DATE;
BEGIN
  INSERT INTO public.leaderboard_weekly (user_id, week_start, xp_this_week)
  VALUES (p_user_id, v_week_start, p_xp)
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET xp_this_week = public.leaderboard_weekly.xp_this_week + p_xp;
END;
$$;
