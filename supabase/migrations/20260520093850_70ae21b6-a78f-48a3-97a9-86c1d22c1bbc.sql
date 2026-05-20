
-- 1. room_questions: split update policy so only author can edit body/resolved
DROP POLICY IF EXISTS "Update room questions" ON public.room_questions;
CREATE POLICY "Owner updates question"
  ON public.room_questions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Upvote RPC (any authenticated user can +1, but cannot set arbitrary values)
CREATE OR REPLACE FUNCTION public.upvote_room_question(p_question_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.room_questions
  SET upvotes = COALESCE(upvotes, 0) + 1
  WHERE id = p_question_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upvote_room_question(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.upvote_room_question(uuid) TO authenticated;

-- 2. increment_xp: cap and bind to caller
CREATE OR REPLACE FUNCTION public.increment_xp(_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF _amount IS NULL OR _amount < 1 OR _amount > 100 THEN RETURN; END IF;
  UPDATE public.user_profiles
  SET xp_total = COALESCE(xp_total, 0) + _amount,
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- 3. Ownership checks on usage / leaderboard RPCs
CREATE OR REPLACE FUNCTION public.increment_ai_messages(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.monthly_usage (user_id, month_year, ai_messages_used)
  VALUES (p_user_id, TO_CHAR(NOW(), 'YYYY-MM'), 1)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET ai_messages_used = public.monthly_usage.ai_messages_used + 1, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_youtube_videos(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.monthly_usage (user_id, month_year, youtube_videos_used)
  VALUES (p_user_id, TO_CHAR(NOW(), 'YYYY-MM'), 1)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET youtube_videos_used = public.monthly_usage.youtube_videos_used + 1, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_weekly_leaderboard(p_user_id uuid, p_xp integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE := DATE_TRUNC('week', NOW())::DATE;
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_xp IS NULL OR p_xp < 1 OR p_xp > 100 THEN RETURN; END IF;
  INSERT INTO public.leaderboard_weekly (user_id, week_start, xp_this_week)
  VALUES (p_user_id, v_week_start, p_xp)
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET xp_this_week = public.leaderboard_weekly.xp_this_week + p_xp;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_usage(p_user_id uuid)
RETURNS TABLE(ai_messages_used integer, youtube_videos_used integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
    SELECT COALESCE(mu.ai_messages_used, 0), COALESCE(mu.youtube_videos_used, 0)
    FROM public.monthly_usage mu
    WHERE mu.user_id = p_user_id
      AND mu.month_year = TO_CHAR(NOW(), 'YYYY-MM');
END;
$$;

-- 4. leaderboard_weekly: read-only via RLS; writes only through SECURITY DEFINER
DROP POLICY IF EXISTS "Users own leaderboard row" ON public.leaderboard_weekly;
CREATE POLICY "Users view own leaderboard"
  ON public.leaderboard_weekly
  FOR SELECT
  USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.leaderboard_weekly FROM authenticated, anon;

-- 5. friendships: only addressee can change status
DROP POLICY IF EXISTS "Users update own friendships" ON public.friendships;
CREATE POLICY "Addressee updates friendship"
  ON public.friendships
  FOR UPDATE
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

-- 6. challenge_completions: read-only via RLS; insert via SECURITY DEFINER
DROP POLICY IF EXISTS "Users own completions" ON public.challenge_completions;
CREATE POLICY "Users view completions"
  ON public.challenge_completions
  FOR SELECT
  USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.challenge_completions FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.complete_challenge(p_key text, p_xp integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_xp IS NULL OR p_xp < 1 OR p_xp > 100 THEN RETURN; END IF;
  INSERT INTO public.challenge_completions (user_id, challenge_key, xp_awarded)
  VALUES (auth.uid(), p_key, p_xp)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.complete_challenge(text, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.complete_challenge(text, integer) TO authenticated;

-- 7. Revoke execute on SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.increment_xp(integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.increment_xp(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_ai_messages(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.increment_ai_messages(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_youtube_videos(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.increment_youtube_videos(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_weekly_leaderboard(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_weekly_leaderboard(uuid, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_monthly_usage(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_monthly_usage(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
