-- ── Admin console backing tables ───────────────────────────────────────────

-- 1. Grant admin to the founder account (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'sadickabbeyquaye@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. DB-backed changelog (replaces the static array; admins publish here)
CREATE TABLE IF NOT EXISTS public.app_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  badge text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published updates" ON public.app_updates
  FOR SELECT USING (published OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins write updates" ON public.app_updates
  FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. AI provider keys — parallel (race/fallback) or rotate (round-robin)
CREATE TABLE IF NOT EXISTS public.api_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                 -- e.g. "Gemini Flash", "Groq Llama-70B"
  provider text NOT NULL,             -- gemini | groq | openrouter | cerebras
  api_key text NOT NULL,
  mode text NOT NULL DEFAULT 'rotate' CHECK (mode IN ('rotate','parallel','disabled')),
  priority int NOT NULL DEFAULT 100,  -- lower = tried first in parallel mode
  enabled boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;
-- Keys are secrets: only admins may ever read or write them
CREATE POLICY "Admins manage providers" ON public.api_providers
  FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. Tunable knobs for the engagement algorithm (single-row settings)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id int PRIMARY KEY DEFAULT 1,
  xp_per_material int NOT NULL DEFAULT 30,
  xp_per_review int NOT NULL DEFAULT 2,
  xp_per_quiz int NOT NULL DEFAULT 10,
  streak_freeze_enabled boolean NOT NULL DEFAULT true,
  daily_goal_xp int NOT NULL DEFAULT 30,
  variable_reward_min int NOT NULL DEFAULT 5,   -- surprise-gem range (variable reward)
  variable_reward_max int NOT NULL DEFAULT 25,
  loss_aversion_nudges boolean NOT NULL DEFAULT true,  -- "your streak is at risk" prompts
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- Everyone may read the knobs (client applies them); only admins change them
CREATE POLICY "Anyone reads settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins write settings" ON public.app_settings
  FOR UPDATE USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5. Admin-only view of users (email + profile + role), via SECURITY DEFINER fn
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (id uuid, email text, full_name text, handle text, xp_total int, created_at timestamptz, is_admin boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.email::text, p.full_name, p.handle, COALESCE(p.xp_total,0),
         u.created_at,
         EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  WHERE public.has_role(auth.uid(),'admin')   -- caller must be admin, else no rows
  ORDER BY u.created_at DESC
  LIMIT 500;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- 6. Promote/demote admins by email (admin only)
CREATE OR REPLACE FUNCTION public.admin_set_role(p_email text, p_make_admin boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT id INTO v_uid FROM auth.users WHERE email = lower(trim(p_email));
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No user with that email'; END IF;
  IF p_make_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid,'admin') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'admin';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(text, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_role(text, boolean) TO authenticated;
