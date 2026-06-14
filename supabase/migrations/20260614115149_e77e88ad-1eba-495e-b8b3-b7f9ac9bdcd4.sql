
-- 1) Move video_url out of public.lessons into a privileged table
CREATE TABLE IF NOT EXISTS public.lesson_videos (
  lesson_id uuid PRIMARY KEY REFERENCES public.lessons(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Migrate existing data
INSERT INTO public.lesson_videos (lesson_id, video_url)
SELECT id, video_url FROM public.lessons WHERE video_url IS NOT NULL
ON CONFLICT (lesson_id) DO NOTHING;

-- No anon, no authenticated grants — only service_role + SECURITY DEFINER fns
REVOKE ALL ON public.lesson_videos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.lesson_videos TO service_role;

ALTER TABLE public.lesson_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage lesson videos" ON public.lesson_videos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Drop the leaky column
ALTER TABLE public.lessons DROP COLUMN IF EXISTS video_url;

-- 2) Update get_lesson_video to read from new table
CREATE OR REPLACE FUNCTION public.get_lesson_video(_lesson_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _course_id uuid; _is_preview boolean; _url text;
BEGIN
  SELECT course_id, is_preview INTO _course_id, _is_preview
    FROM public.lessons WHERE id = _lesson_id;
  IF _course_id IS NULL THEN RETURN NULL; END IF;
  SELECT video_url INTO _url FROM public.lesson_videos WHERE lesson_id = _lesson_id;
  IF _url IS NULL THEN RETURN NULL; END IF;
  IF _is_preview THEN RETURN _url; END IF;
  IF _uid IS NULL THEN RETURN NULL; END IF;
  IF public.has_role(_uid,'admin') THEN RETURN _url; END IF;
  IF EXISTS (SELECT 1 FROM public.enrollments WHERE user_id=_uid AND course_id=_course_id) THEN
    RETURN _url;
  END IF;
  RETURN NULL;
END $$;

-- 3) Admin-only RPC to set a lesson's video URL
CREATE OR REPLACE FUNCTION public.set_lesson_video(_lesson_id uuid, _video_url text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _video_url IS NULL OR length(trim(_video_url)) = 0 THEN
    DELETE FROM public.lesson_videos WHERE lesson_id = _lesson_id;
  ELSE
    INSERT INTO public.lesson_videos(lesson_id, video_url)
    VALUES (_lesson_id, _video_url)
    ON CONFLICT (lesson_id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now();
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_lesson_video(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_lesson_video(uuid, text) TO authenticated;

-- 4) Realtime authorization: lock broadcast/presence channels by topic
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read own realtime topics" ON realtime.messages;
CREATE POLICY "auth read own realtime topics" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    (realtime.topic() = 'notif:' || auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.user_id = auth.uid()
        AND realtime.topic() = 'conversation:' || cp.conversation_id::text
    )
  );

DROP POLICY IF EXISTS "auth send own realtime topics" ON realtime.messages;
CREATE POLICY "auth send own realtime topics" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (realtime.topic() = 'notif:' || auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.user_id = auth.uid()
        AND realtime.topic() = 'conversation:' || cp.conversation_id::text
    )
  );
