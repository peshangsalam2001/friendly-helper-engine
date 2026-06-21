DROP POLICY IF EXISTS "delete own messages" ON public.chat_messages;
CREATE POLICY "delete own messages within 24h or admin"
ON public.chat_messages FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (sender_id = auth.uid() AND created_at >= now() - interval '24 hours')
);