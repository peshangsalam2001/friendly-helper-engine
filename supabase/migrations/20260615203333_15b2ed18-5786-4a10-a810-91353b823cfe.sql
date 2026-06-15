
-- Add attachments column to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Allow empty body when attachments exist
ALTER TABLE public.chat_messages ALTER COLUMN body DROP NOT NULL;

-- Search users RPC (username/phone/name) — authenticated only
CREATE OR REPLACE FUNCTION public.search_users(_q text)
RETURNS TABLE (id uuid, username text, full_name text, phone text, is_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.username, p.full_name, p.phone,
         public.has_role(p.id, 'admin'::app_role) AS is_admin
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND _q IS NOT NULL AND length(trim(_q)) >= 2
    AND (
      lower(coalesce(p.username,'')) LIKE lower('%'||_q||'%')
      OR coalesce(p.phone,'') LIKE '%'||_q||'%'
      OR lower(coalesce(p.full_name,'')) LIKE lower('%'||_q||'%')
    )
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- Get role label for a user (used to show "Admin"/"User" under name)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN public.has_role(_user_id,'admin') THEN 'admin' ELSE 'user' END;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- Storage policies for chat-attachments
-- Path layout: <conversation_id>/<uuid>-<filename>
CREATE POLICY "chat upload to own conv"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.is_conversation_participant(
    (split_part(name, '/', 1))::uuid, auth.uid()
  )
);

CREATE POLICY "chat read in own conv"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    public.has_role(auth.uid(),'admin')
    OR public.is_conversation_participant(
      (split_part(name, '/', 1))::uuid, auth.uid()
    )
  )
);

CREATE POLICY "chat delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND owner = auth.uid()
);
