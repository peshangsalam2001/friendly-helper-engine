
-- 1. Teacher field
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS teacher text;

-- 2. Buyer count function (publicly callable)
CREATE OR REPLACE FUNCTION public.get_course_buyer_count(_course_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.enrollments WHERE course_id = _course_id;
$$;
REVOKE EXECUTE ON FUNCTION public.get_course_buyer_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_buyer_count(uuid) TO anon, authenticated;

-- 3. Total duration function
CREATE OR REPLACE FUNCTION public.get_course_total_duration(_course_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(duration_seconds), 0)::int FROM public.lessons WHERE course_id = _course_id;
$$;
REVOKE EXECUTE ON FUNCTION public.get_course_total_duration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_total_duration(uuid) TO anon, authenticated;

-- 4. Storage policies for course-images bucket
CREATE POLICY "course-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'course-images');

CREATE POLICY "course-images admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "course-images admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "course-images admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-images' AND public.has_role(auth.uid(), 'admin'));
