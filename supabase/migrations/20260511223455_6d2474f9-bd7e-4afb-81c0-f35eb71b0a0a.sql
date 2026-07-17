
-- Roles system
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage roles ins" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage roles upd" ON public.user_roles
  FOR UPDATE USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage roles del" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- Seed initial admin (skipped if the user doesn't exist in this project)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE id = 'cf5bf89f-2dd8-4583-b215-3638214be2c6'
ON CONFLICT DO NOTHING;
