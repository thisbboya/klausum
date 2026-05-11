
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_xp(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_xp(INTEGER) TO authenticated;
