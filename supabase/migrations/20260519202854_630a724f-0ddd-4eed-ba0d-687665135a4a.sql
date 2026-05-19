CREATE OR REPLACE FUNCTION public.set_pioneer_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_at < '2027-01-01'::timestamptz THEN
    NEW.is_day1_pioneer := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_pioneer_flag_trg ON public.user_profiles;
CREATE TRIGGER set_pioneer_flag_trg
BEFORE INSERT ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_pioneer_flag();