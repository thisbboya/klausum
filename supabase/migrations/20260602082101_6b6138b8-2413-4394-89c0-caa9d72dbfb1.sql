
-- 1. user_profiles: tighten SELECT to own-only, expose safe fields via a view
DROP POLICY IF EXISTS "Authenticated can search profiles" ON public.user_profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT
  id, handle, full_name, avatar_url, level, school, country, field_of_study,
  companion_id, companion_name, xp_total, streak_days, longest_streak,
  is_day1_pioneer, cohort_units, created_at
FROM public.user_profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 2. room membership helper (SECURITY DEFINER bypasses RLS, prevents recursion)
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = _user_id
  )
$$;

-- 3. Restrict room_messages / room_questions / room_members SELECT to members
DROP POLICY IF EXISTS "View room messages" ON public.room_messages;
CREATE POLICY "View room messages" ON public.room_messages
FOR SELECT TO authenticated
USING (public.is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "View room questions" ON public.room_questions;
CREATE POLICY "View room questions" ON public.room_questions
FOR SELECT TO authenticated
USING (public.is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "View room members" ON public.room_members;
CREATE POLICY "View room members" ON public.room_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR public.is_room_member(room_id, auth.uid())
);

-- 4. Prevent owners from editing their own upvote count via column-level grant
REVOKE UPDATE ON public.room_questions FROM authenticated;
GRANT UPDATE (body, resolved) ON public.room_questions TO authenticated;
-- (upvotes column intentionally omitted; upvote_room_question RPC remains the only path)
