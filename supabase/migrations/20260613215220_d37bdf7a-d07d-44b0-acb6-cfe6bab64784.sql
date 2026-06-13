
CREATE OR REPLACE FUNCTION public.purchase_course(_course_id uuid)
RETURNS public.enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _price numeric;
  _balance numeric;
  _enrollment public.enrollments;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT price INTO _price FROM public.courses WHERE id = _course_id AND is_published = true;
  IF _price IS NULL THEN RAISE EXCEPTION 'course_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = _uid AND course_id = _course_id) THEN
    RAISE EXCEPTION 'already_enrolled';
  END IF;

  SELECT balance INTO _balance FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _balance IS NULL OR _balance < _price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE public.profiles SET balance = balance - _price WHERE id = _uid;

  INSERT INTO public.enrollments (user_id, course_id, price_paid)
  VALUES (_uid, _course_id, _price)
  RETURNING * INTO _enrollment;

  INSERT INTO public.messages (user_id, title, body)
  VALUES (_uid, 'کڕینی کۆرس سەرکەوتوو بوو',
    'تۆ کۆرسێکت کڕی. دەتوانیت ئێستا سەیری وانەکانی بکەیت.');

  RETURN _enrollment;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.purchase_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_course(uuid) TO authenticated;

-- Approve/reject topup atomically (admin only)
CREATE OR REPLACE FUNCTION public.review_topup(_topup_id uuid, _approve boolean, _admin_note text DEFAULT NULL)
RETURNS public.topup_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _req public.topup_requests;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO _req FROM public.topup_requests WHERE id = _topup_id FOR UPDATE;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'already_reviewed'; END IF;

  IF _approve THEN
    UPDATE public.profiles SET balance = balance + _req.amount WHERE id = _req.user_id;
    UPDATE public.topup_requests
      SET status='approved', reviewed_by=_uid, reviewed_at=now(), admin_note=_admin_note
      WHERE id = _topup_id RETURNING * INTO _req;
    INSERT INTO public.messages (user_id, title, body)
    VALUES (_req.user_id, 'باڵانس زیادکرا',
      'بڕی ' || _req.amount::text || ' دینار خرایە سەر باڵانسەکەت.');
  ELSE
    UPDATE public.topup_requests
      SET status='rejected', reviewed_by=_uid, reviewed_at=now(), admin_note=_admin_note
      WHERE id = _topup_id RETURNING * INTO _req;
    INSERT INTO public.messages (user_id, title, body)
    VALUES (_req.user_id, 'داواکاری زیادکردنی باڵانس ڕەتکرایەوە',
      COALESCE(_admin_note, 'تکایە دووبارە هەوڵبدەرەوە.'));
  END IF;

  RETURN _req;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.review_topup(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_topup(uuid, boolean, text) TO authenticated;
