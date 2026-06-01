
-- Cap grant_rewards to prevent client-side reward inflation
CREATE OR REPLACE FUNCTION public.grant_rewards(_xp integer, _gems integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF _xp IS NULL OR _xp < 0 THEN _xp := 0; END IF;
  IF _gems IS NULL OR _gems < 0 THEN _gems := 0; END IF;
  -- Hard server-side caps per single call (chest/quest rewards are well below these)
  IF _xp > 200 THEN _xp := 200; END IF;
  IF _gems > 100 THEN _gems := 100; END IF;
  UPDATE public.user_profiles
  SET xp_total = COALESCE(xp_total, 0) + _xp,
      gems = COALESCE(gems, 0) + _gems,
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$function$;

-- Tighten daily_quests update policy so users can't inflate reward amounts on their rows
DROP POLICY IF EXISTS quests_own_update ON public.daily_quests;
CREATE POLICY quests_own_update ON public.daily_quests
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND reward_xp <= 200 AND reward_gems <= 100);
