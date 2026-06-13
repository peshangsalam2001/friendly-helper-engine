
REVOKE SELECT (video_url) ON public.lessons FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_lesson_video(_lesson_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _course_id uuid; _is_preview boolean; _url text;
BEGIN
  SELECT course_id, is_preview, video_url INTO _course_id, _is_preview, _url
    FROM public.lessons WHERE id = _lesson_id;
  IF _course_id IS NULL THEN RETURN NULL; END IF;
  IF _is_preview THEN RETURN _url; END IF;
  IF _uid IS NULL THEN RETURN NULL; END IF;
  IF public.has_role(_uid, 'admin') THEN RETURN _url; END IF;
  IF EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = _uid AND course_id = _course_id) THEN
    RETURN _url;
  END IF;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_lesson_video(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lesson_video(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "enrollments admin manage" ON public.enrollments;
CREATE POLICY "enrollments admin manage" ON public.enrollments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "payment-proofs admin delete" ON storage.objects;
CREATE POLICY "payment-proofs admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "payment-proofs admin update" ON storage.objects;
CREATE POLICY "payment-proofs admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));
