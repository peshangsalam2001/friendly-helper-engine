
CREATE OR REPLACE FUNCTION public.purchase_course(_course_id uuid)
 RETURNS enrollments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _price numeric;
  _balance numeric;
  _enrollment public.enrollments;
  _email text;
  _unlimited boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT price INTO _price FROM public.courses WHERE id = _course_id AND is_published = true;
  IF _price IS NULL THEN RAISE EXCEPTION 'course_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = _uid AND course_id = _course_id) THEN
    RAISE EXCEPTION 'already_enrolled';
  END IF;

  SELECT lower(email) INTO _email FROM auth.users WHERE id = _uid;
  IF _email = 'peshangsalam2001@gmail.com' AND public.has_role(_uid, 'admin') THEN
    _unlimited := true;
  END IF;

  IF NOT _unlimited THEN
    SELECT balance INTO _balance FROM public.profiles WHERE id = _uid FOR UPDATE;
    IF _balance IS NULL OR _balance < _price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
    UPDATE public.profiles SET balance = balance - _price WHERE id = _uid;
  END IF;

  INSERT INTO public.enrollments (user_id, course_id, price_paid)
  VALUES (_uid, _course_id, CASE WHEN _unlimited THEN 0 ELSE _price END)
  RETURNING * INTO _enrollment;

  INSERT INTO public.messages (user_id, title, body)
  VALUES (_uid, 'کڕینی کۆرس سەرکەوتوو بوو',
    'تۆ کۆرسێکت کڕی. دەتوانیت ئێستا سەیری وانەکانی بکەیت.');

  RETURN _enrollment;
END;
$function$;
