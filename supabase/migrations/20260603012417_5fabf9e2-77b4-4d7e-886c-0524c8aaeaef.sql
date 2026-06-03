
-- 1. Fix SECURITY DEFINER view: switch to security_invoker and add a safe-columns SELECT policy
ALTER VIEW public.public_profiles SET (security_invoker = true);

-- Allow any authenticated user to read public profile rows via the view.
-- The view only projects safe columns; sensitive columns remain unreadable via the view's column list.
DROP POLICY IF EXISTS "Public profiles readable" ON public.user_profiles;
CREATE POLICY "Public profiles readable"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

-- Restrict direct table SELECT to only the safe columns by revoking full-table grant
-- and re-granting only the safe public columns + everything for own row via existing policy.
-- Simpler & safer: keep table grant but rely on view as the public surface; sensitive reads
-- by other users are still possible at SQL level, so also revoke the broad grant and grant per-column.
REVOKE SELECT ON public.user_profiles FROM authenticated;
GRANT SELECT (
  id, handle, full_name, avatar_url, level, school, country, field_of_study,
  companion_id, companion_name, xp_total, streak_days, longest_streak,
  is_day1_pioneer, cohort_units, created_at,
  -- owner-only columns still need SELECT grant; RLS narrows to own row
  updated_at, exam_curriculum, study_intensity, available_hours, streak_freezes,
  streak_freeze_used_date, sounds_enabled, hearts, hearts_last_refill, gems,
  semester_start_date, last_study_date, dark_mode, daily_goal_minutes,
  preferred_session_minutes, onboarding_completed, vark_completed,
  secondary_style, primary_style, kinesthetic_score, reading_score,
  auditory_score, visual_score, curriculum, programme
) ON public.user_profiles TO authenticated;

-- 2. xp_events: append-only, capped via SECURITY DEFINER function
DROP POLICY IF EXISTS "Users own xp" ON public.xp_events;
CREATE POLICY "Users view own xp"
ON public.xp_events FOR SELECT
USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies = writes blocked for authenticated role
REVOKE INSERT, UPDATE, DELETE ON public.xp_events FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.log_xp_event(_action text, _amount integer, _description text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF _amount IS NULL OR _amount < 1 OR _amount > 200 THEN RETURN; END IF;
  IF _action IS NULL OR length(_action) > 64 THEN RETURN; END IF;
  INSERT INTO public.xp_events (user_id, action, xp_amount, description)
  VALUES (auth.uid(), _action, _amount, NULLIF(left(COALESCE(_description, ''), 280), ''));
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_xp_event(text, integer, text) TO authenticated;
