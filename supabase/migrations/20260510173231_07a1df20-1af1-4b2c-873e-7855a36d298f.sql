UPDATE storage.buckets
SET public = false
WHERE id = 'kb-files';

DROP POLICY IF EXISTS "KB files: public read" ON storage.objects;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "messages_realtime_authorized" ON realtime.messages;

CREATE POLICY "Authorized users can receive message events"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'messages-realtime'
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.id = realtime.messages.id
      AND (
        m.sender_id = auth.uid()
        OR m.recipient_id = auth.uid()
        OR public.is_admin(auth.uid())
        OR public.is_manager_of(auth.uid(), m.sender_id)
        OR public.is_manager_of(auth.uid(), m.recipient_id)
      )
  )
);