
-- 1) user_profiles: drop the open authenticated SELECT policy; cross-user reads must go through public_profiles view
DROP POLICY IF EXISTS "Public profiles readable" ON public.user_profiles;

-- 2) chest_openings: remove client insert. Awards happen via SECURITY DEFINER RPC only.
DROP POLICY IF EXISTS "chests_own_insert" ON public.chest_openings;

CREATE OR REPLACE FUNCTION public.open_chest(_tier text)
RETURNS TABLE(reward_xp integer, reward_gems integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_xp int; v_gems int;
  v_min_xp int; v_max_xp int; v_min_gems int; v_max_gems int;
  v_exists boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _tier NOT IN ('bronze','silver','gold','perfect_quiz') THEN
    RAISE EXCEPTION 'Invalid tier';
  END IF;

  -- One daily chest per tier (perfect_quiz allowed multiple per day but capped by reward)
  IF _tier IN ('bronze','silver','gold') THEN
    SELECT EXISTS(
      SELECT 1 FROM public.chest_openings
      WHERE user_id = auth.uid() AND tier = _tier AND opened_at >= CURRENT_DATE
    ) INTO v_exists;
    IF v_exists THEN RAISE EXCEPTION 'Already opened today'; END IF;
  END IF;

  CASE _tier
    WHEN 'bronze' THEN v_min_xp:=10; v_max_xp:=25;  v_min_gems:=5;  v_max_gems:=15;
    WHEN 'silver' THEN v_min_xp:=25; v_max_xp:=60;  v_min_gems:=15; v_max_gems:=35;
    WHEN 'gold'   THEN v_min_xp:=60; v_max_xp:=150; v_min_gems:=35; v_max_gems:=80;
    ELSE              v_min_xp:=25; v_max_xp:=25;  v_min_gems:=10; v_max_gems:=10;
  END CASE;

  v_xp   := v_min_xp   + floor(random() * (v_max_xp   - v_min_xp   + 1))::int;
  v_gems := v_min_gems + floor(random() * (v_max_gems - v_min_gems + 1))::int;

  UPDATE public.user_profiles
     SET xp_total = COALESCE(xp_total, 0) + v_xp,
         gems     = COALESCE(gems, 0) + v_gems,
         updated_at = now()
   WHERE id = auth.uid();

  INSERT INTO public.chest_openings (user_id, tier, reward_xp, reward_gems)
  VALUES (auth.uid(), _tier, v_xp, v_gems);

  reward_xp := v_xp;
  reward_gems := v_gems;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.open_chest(text) FROM public;
GRANT EXECUTE ON FUNCTION public.open_chest(text) TO authenticated;

-- 3) study_group_members: invite-code must be enforced server-side via RPC. Drop direct INSERT policy and auto-add creator via trigger.
DROP POLICY IF EXISTS "Join group" ON public.study_group_members;

CREATE OR REPLACE FUNCTION public._auto_add_group_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.study_group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.creator_id, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_study_groups_add_creator ON public.study_groups;
CREATE TRIGGER trg_study_groups_add_creator
AFTER INSERT ON public.study_groups
FOR EACH ROW EXECUTE FUNCTION public._auto_add_group_creator();

CREATE OR REPLACE FUNCTION public.join_study_group(p_invite_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_invite_code IS NULL OR length(p_invite_code) < 4 OR length(p_invite_code) > 32 THEN
    RAISE EXCEPTION 'Invalid code';
  END IF;
  SELECT id INTO v_gid FROM public.study_groups
   WHERE invite_code = upper(p_invite_code) LIMIT 1;
  IF v_gid IS NULL THEN RAISE EXCEPTION 'Invite code not found'; END IF;
  INSERT INTO public.study_group_members (group_id, user_id, role)
  VALUES (v_gid, auth.uid(), 'member')
  ON CONFLICT DO NOTHING;
  UPDATE public.study_groups
     SET member_count = (SELECT count(*) FROM public.study_group_members WHERE group_id = v_gid)
   WHERE id = v_gid;
  RETURN v_gid;
END; $$;
REVOKE ALL ON FUNCTION public.join_study_group(text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_study_group(text) TO authenticated;

-- 4) room_messages / room_questions: require membership at the database layer
DROP POLICY IF EXISTS "Post room messages" ON public.room_messages;
CREATE POLICY "Post room messages" ON public.room_messages
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "Post room questions" ON public.room_questions;
CREATE POLICY "Post room questions" ON public.room_questions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_room_member(room_id, auth.uid()));

-- 5) room_members: only allow joining rooms that are currently active
DROP POLICY IF EXISTS "Join rooms" ON public.room_members;
CREATE POLICY "Join rooms" ON public.room_members
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.study_rooms WHERE id = room_id AND is_active = true)
);
