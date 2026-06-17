
-- 1) user_roles: explicit restrictive policies to block all client-side writes
CREATE POLICY "no client insert on user_roles"
  ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "no client update on user_roles"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "no client delete on user_roles"
  ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);

-- 2) chat-attachments: explicit deny UPDATE policy
CREATE POLICY "chat attachments no update"
  ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'chat-attachments')
  WITH CHECK (bucket_id <> 'chat-attachments');

-- 3) realtime: explicitly deny conversations:* broadcast topic for non-participants
-- The existing policies only permit notif:/conversation: topics, so conversations:*
-- topics are already implicitly denied. We add an explicit restrictive policy as a
-- belt-and-braces guard so future permissive policies cannot accidentally widen access.
CREATE POLICY "deny conversations broadcast topic"
  ON realtime.messages AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT (realtime.topic() LIKE 'conversations:%')
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.user_id = auth.uid()
        AND realtime.topic() = ('conversations:' || cp.conversation_id::text)
    )
  );
