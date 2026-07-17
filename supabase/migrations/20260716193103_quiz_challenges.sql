-- Friend quiz duels (CourieX-style 1v1 challenges)

CREATE TABLE public.quiz_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  opponent_id uuid NOT NULL,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  time_limit_seconds integer NOT NULL DEFAULT 60,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired')),
  challenger_score numeric,
  opponent_score numeric,
  winner_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.quiz_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view their duels" ON public.quiz_challenges
  FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "Challenger creates duels" ON public.quiz_challenges
  FOR INSERT WITH CHECK (auth.uid() = challenger_id);

-- Opponents need to read the challenger's quiz to take it
CREATE POLICY "Duel opponents can view challenged quiz" ON public.quizzes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quiz_challenges qc
      WHERE qc.quiz_id = quizzes.id AND qc.opponent_id = auth.uid()
    )
  );

-- Score submission is funneled through this SECURITY DEFINER function so
-- clients can never forge the other participant's score or the winner.
CREATE OR REPLACE FUNCTION public.submit_duel_score(p_challenge_id uuid, p_score integer, p_total integer)
RETURNS public.quiz_challenges
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.quiz_challenges;
  v_pct numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_row FROM public.quiz_challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF auth.uid() NOT IN (v_row.challenger_id, v_row.opponent_id) THEN
    RAISE EXCEPTION 'Not a participant in this challenge';
  END IF;

  IF v_row.expires_at < now() THEN
    UPDATE public.quiz_challenges SET status = 'expired' WHERE id = p_challenge_id RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  v_pct := CASE WHEN p_total > 0 THEN round((p_score::numeric / p_total) * 100, 1) ELSE 0 END;

  IF auth.uid() = v_row.challenger_id THEN
    UPDATE public.quiz_challenges
      SET challenger_score = v_pct,
          status = CASE WHEN opponent_score IS NOT NULL THEN 'completed' ELSE 'active' END
      WHERE id = p_challenge_id
      RETURNING * INTO v_row;
  ELSE
    UPDATE public.quiz_challenges
      SET opponent_score = v_pct,
          status = CASE WHEN challenger_score IS NOT NULL THEN 'completed' ELSE 'active' END
      WHERE id = p_challenge_id
      RETURNING * INTO v_row;
  END IF;

  IF v_row.status = 'completed' AND v_row.winner_id IS NULL THEN
    UPDATE public.quiz_challenges
      SET winner_id = CASE
        WHEN challenger_score > opponent_score THEN challenger_id
        WHEN opponent_score > challenger_score THEN opponent_id
        ELSE NULL
      END
      WHERE id = p_challenge_id
      RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_duel_score(uuid, integer, integer) TO authenticated;
