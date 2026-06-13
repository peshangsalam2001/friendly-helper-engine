
-- Revoke direct column access to private video URLs
REVOKE SELECT (video_url) ON public.lessons FROM anon, authenticated;

-- Lock down SECURITY DEFINER functions: revoke from PUBLIC, grant only where needed
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.purchase_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_course(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_topup(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_topup(uuid, boolean, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_lesson_video(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lesson_video(uuid) TO anon, authenticated;

-- Trigger-only functions: should not be callable via API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
