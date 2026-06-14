
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles WITH (security_invoker = true) AS
  SELECT id, full_name FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated;

REVOKE EXECUTE ON FUNCTION public.start_dm(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_support_chat() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.post_announcement(text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_announcement_conversation() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid,uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.start_dm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_support_chat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_announcement(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_announcement_conversation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid,uuid) TO authenticated;
