DROP POLICY IF EXISTS "lessons public meta" ON public.lessons;
CREATE POLICY "lessons public meta" ON public.lessons
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = lessons.course_id
      AND (c.is_published OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);