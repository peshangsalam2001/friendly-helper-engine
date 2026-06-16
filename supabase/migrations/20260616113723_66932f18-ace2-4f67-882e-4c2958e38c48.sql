CREATE OR REPLACE VIEW public.public_profiles AS SELECT id, full_name, username FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated, anon;