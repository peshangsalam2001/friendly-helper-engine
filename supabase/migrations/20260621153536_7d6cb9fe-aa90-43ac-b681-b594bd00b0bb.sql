DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
  WITH (security_invoker = false) AS
  SELECT id, full_name, username FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated, anon;