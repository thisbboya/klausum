
CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost int;
  v_gems int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  CASE _item
    WHEN 'streak_freeze' THEN v_cost := 30;
    WHEN 'xp_boost'      THEN v_cost := 50;
    WHEN 'hint_pack'     THEN v_cost := 20;
    ELSE RAISE EXCEPTION 'Unknown item';
  END CASE;

  SELECT COALESCE(gems, 0) INTO v_gems FROM public.user_profiles WHERE id = auth.uid();
  IF v_gems < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_gems', 'cost', v_cost, 'balance', v_gems);
  END IF;

  UPDATE public.user_profiles
     SET gems = COALESCE(gems, 0) - v_cost,
         streak_freezes = CASE WHEN _item = 'streak_freeze' THEN COALESCE(streak_freezes, 0) + 1 ELSE COALESCE(streak_freezes, 0) END,
         updated_at = now()
   WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'item', _item, 'cost', v_cost, 'balance', v_gems - v_cost);
END; $$;

GRANT EXECUTE ON FUNCTION public.purchase_shop_item(text) TO authenticated;
