
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.conversation_type AS ENUM ('dm','support','course_group','announcement');
CREATE TYPE public.notification_type AS ENUM ('new_course','balance_approved','balance_rejected','announcement','chat_message','enrollment');

-- =========================================================================
-- CONVERSATIONS
-- =========================================================================
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.conversation_type NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  title text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX conversations_course_group_unique ON public.conversations(course_id) WHERE type = 'course_group';
CREATE UNIQUE INDEX conversations_announcement_unique ON public.conversations((1)) WHERE type = 'announcement';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- PARTICIPANTS
-- =========================================================================
CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT 'epoch',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_participants_user_idx ON public.conversation_participants(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- CHAT MESSAGES
-- =========================================================================
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_conv_idx ON public.chat_messages(conversation_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- NOTIFICATION PREFERENCES
-- =========================================================================
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  new_course boolean NOT NULL DEFAULT true,
  balance_update boolean NOT NULL DEFAULT true,
  announcement boolean NOT NULL DEFAULT true,
  chat_message boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- PUBLIC PROFILES VIEW (id + name only, for user pickers)
-- =========================================================================
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, full_name FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated;

-- =========================================================================
-- SECURITY DEFINER HELPER: is participant
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conv AND user_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conv AND c.type = 'announcement'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_announcement_conversation()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM public.conversations WHERE type = 'announcement' LIMIT 1;
  IF _id IS NULL THEN
    INSERT INTO public.conversations(type, title) VALUES ('announcement', 'ڕاگەیاندنەکان') RETURNING id INTO _id;
  END IF;
  RETURN _id;
END $$;

-- =========================================================================
-- RLS POLICIES
-- =========================================================================
-- conversations
CREATE POLICY "view own conversations" ON public.conversations FOR SELECT TO authenticated
  USING (
    type = 'announcement'
    OR public.has_role(auth.uid(),'admin')
    OR public.is_conversation_participant(id, auth.uid())
  );
CREATE POLICY "users create conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    (type IN ('dm','support') AND created_by = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "admin update conversations" ON public.conversations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete conversations" ON public.conversations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- participants
CREATE POLICY "view own participation" ON public.conversation_participants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.is_conversation_participant(conversation_id, auth.uid())
  );
CREATE POLICY "join conversations" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  );
CREATE POLICY "update own read" ON public.conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "leave or admin remove" ON public.conversation_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- chat_messages
CREATE POLICY "view messages in own conv" ON public.chat_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_conversation_participant(conversation_id, auth.uid())
  );
CREATE POLICY "send messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.has_role(auth.uid(),'admin')
      OR (
        public.is_conversation_participant(conversation_id, auth.uid())
        AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.type = 'announcement')
      )
    )
  );
CREATE POLICY "delete own messages" ON public.chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- notifications
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- notification_preferences
CREATE POLICY "own prefs select" ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own prefs upsert" ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prefs update" ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- =========================================================================
-- RPCs
-- =========================================================================
CREATE OR REPLACE FUNCTION public.start_dm(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _me = _other THEN RAISE EXCEPTION 'cannot_dm_self'; END IF;

  SELECT c.id INTO _id FROM public.conversations c
  WHERE c.type = 'dm'
    AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = _me)
    AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = _other)
  LIMIT 1;

  IF _id IS NULL THEN
    INSERT INTO public.conversations(type, created_by) VALUES ('dm', _me) RETURNING id INTO _id;
    INSERT INTO public.conversation_participants(conversation_id, user_id) VALUES (_id, _me),(_id, _other);
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.start_support_chat()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _id uuid; _admin uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT c.id INTO _id FROM public.conversations c
  WHERE c.type = 'support' AND c.created_by = _me LIMIT 1;
  IF _id IS NULL THEN
    INSERT INTO public.conversations(type, created_by, title) VALUES ('support', _me, 'پشتگیری') RETURNING id INTO _id;
    INSERT INTO public.conversation_participants(conversation_id, user_id) VALUES (_id, _me);
    FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.conversation_participants(conversation_id, user_id) VALUES (_id, _admin) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.post_announcement(_title text, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _conv uuid; _msg uuid; _me uuid := auth.uid();
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  _conv := public.get_announcement_conversation();
  INSERT INTO public.chat_messages(conversation_id, sender_id, body)
  VALUES (_conv, _me, _title || E'\n\n' || COALESCE(_body,'')) RETURNING id INTO _msg;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  SELECT p.id, 'announcement', _title, _body, '/messages'
  FROM public.profiles p
  LEFT JOIN public.notification_preferences np ON np.user_id = p.id
  WHERE COALESCE(np.announcement, true) = true;
  RETURN _msg;
END $$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = _conv AND user_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.notifications SET is_read = true WHERE user_id = auth.uid() AND is_read = false;
END $$;

-- =========================================================================
-- TRIGGERS
-- =========================================================================
-- new course → notify all users (if pref) + create group conversation
CREATE OR REPLACE FUNCTION public.on_course_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _conv uuid;
BEGIN
  INSERT INTO public.conversations(type, course_id, title) VALUES ('course_group', NEW.id, NEW.title) RETURNING id INTO _conv;
  INSERT INTO public.conversation_participants(conversation_id, user_id)
  SELECT _conv, user_id FROM public.user_roles WHERE role = 'admin' ON CONFLICT DO NOTHING;
  IF NEW.is_published THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT p.id, 'new_course', 'کۆرسی نوێ زیادکرا', NEW.title, '/courses/' || NEW.id::text
    FROM public.profiles p
    LEFT JOIN public.notification_preferences np ON np.user_id = p.id
    WHERE COALESCE(np.new_course, true) = true;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_on_course_created AFTER INSERT ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.on_course_created();

-- enrollment → join group + add buyer notification for admins? skip; just add participant
CREATE OR REPLACE FUNCTION public.on_enrollment_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _conv uuid;
BEGIN
  SELECT id INTO _conv FROM public.conversations WHERE type = 'course_group' AND course_id = NEW.course_id;
  IF _conv IS NULL THEN
    INSERT INTO public.conversations(type, course_id, title)
    SELECT 'course_group', c.id, c.title FROM public.courses c WHERE c.id = NEW.course_id
    RETURNING id INTO _conv;
    INSERT INTO public.conversation_participants(conversation_id, user_id)
    SELECT _conv, user_id FROM public.user_roles WHERE role = 'admin' ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.conversation_participants(conversation_id, user_id) VALUES (_conv, NEW.user_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_on_enrollment_created AFTER INSERT ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.on_enrollment_created();

-- chat message → notifications for other participants
CREATE OR REPLACE FUNCTION public.on_chat_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ctype public.conversation_type; _sender_name text;
BEGIN
  SELECT type INTO _ctype FROM public.conversations WHERE id = NEW.conversation_id;
  IF _ctype = 'announcement' THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name,'بەکارهێنەر') INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  SELECT cp.user_id, 'chat_message', _sender_name, LEFT(NEW.body, 120), '/messages?c=' || NEW.conversation_id::text
  FROM public.conversation_participants cp
  LEFT JOIN public.notification_preferences np ON np.user_id = cp.user_id
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id
    AND COALESCE(np.chat_message, true) = true;
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_on_chat_message_created AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.on_chat_message_created();

-- default prefs on new user
CREATE OR REPLACE FUNCTION public.on_profile_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notification_preferences(user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_on_profile_created AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.on_profile_created();

-- replace balance review function to also create notifications
CREATE OR REPLACE FUNCTION public.review_topup(_topup_id uuid, _approve boolean, _admin_note text DEFAULT NULL)
RETURNS public.topup_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _req public.topup_requests;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _req FROM public.topup_requests WHERE id = _topup_id FOR UPDATE;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'already_reviewed'; END IF;
  IF _approve THEN
    UPDATE public.profiles SET balance = balance + _req.amount WHERE id = _req.user_id;
    UPDATE public.topup_requests SET status='approved', reviewed_by=_uid, reviewed_at=now(), admin_note=_admin_note WHERE id = _topup_id RETURNING * INTO _req;
    INSERT INTO public.messages (user_id, title, body) VALUES (_req.user_id, 'باڵانس زیادکرا','بڕی ' || _req.amount::text || ' دینار خرایە سەر باڵانسەکەت.');
    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT _req.user_id, 'balance_approved', 'باڵانس پەسەندکرا', 'بڕی ' || _req.amount::text || ' دینار زیادکرا.', '/account'
    WHERE COALESCE((SELECT balance_update FROM public.notification_preferences WHERE user_id = _req.user_id), true);
  ELSE
    UPDATE public.topup_requests SET status='rejected', reviewed_by=_uid, reviewed_at=now(), admin_note=_admin_note WHERE id = _topup_id RETURNING * INTO _req;
    INSERT INTO public.messages (user_id, title, body) VALUES (_req.user_id, 'داواکاری زیادکردنی باڵانس ڕەتکرایەوە', COALESCE(_admin_note,'تکایە دووبارە هەوڵبدەرەوە.'));
    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT _req.user_id, 'balance_rejected', 'داواکاری ڕەتکرایەوە', COALESCE(_admin_note,''), '/topup'
    WHERE COALESCE((SELECT balance_update FROM public.notification_preferences WHERE user_id = _req.user_id), true);
  END IF;
  RETURN _req;
END $$;

-- =========================================================================
-- REALTIME
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- =========================================================================
-- BACKFILL: announcement conversation + course groups + prefs
-- =========================================================================
SELECT public.get_announcement_conversation();

INSERT INTO public.conversations(type, course_id, title)
SELECT 'course_group', c.id, c.title FROM public.courses c
WHERE NOT EXISTS (SELECT 1 FROM public.conversations cv WHERE cv.type='course_group' AND cv.course_id = c.id);

INSERT INTO public.conversation_participants(conversation_id, user_id)
SELECT cv.id, ur.user_id FROM public.conversations cv
CROSS JOIN public.user_roles ur
WHERE cv.type = 'course_group' AND ur.role = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.conversation_participants(conversation_id, user_id)
SELECT cv.id, e.user_id FROM public.enrollments e
JOIN public.conversations cv ON cv.type='course_group' AND cv.course_id = e.course_id
ON CONFLICT DO NOTHING;

INSERT INTO public.notification_preferences(user_id)
SELECT id FROM public.profiles ON CONFLICT DO NOTHING;
