
-- 1. Dedupe existing phones: keep oldest profile, null out the rest
WITH ranked AS (
  SELECT id, phone,
    ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at ASC) AS rn
  FROM public.profiles
  WHERE phone IS NOT NULL
)
UPDATE public.profiles p SET phone = NULL
FROM ranked r WHERE p.id = r.id AND r.rn > 1;

-- 2. Add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS referral_source text;

-- 3. Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_key ON public.profiles (phone) WHERE phone IS NOT NULL;

-- 4. Helper functions
CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(_username));
$$;

CREATE OR REPLACE FUNCTION public.phone_available(_phone text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE phone = _phone);
$$;

CREATE OR REPLACE FUNCTION public.email_for_username(_username text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.email FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(p.username) = lower(_username) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon, authenticated;

-- 5. Update the on_profile_created trigger function (it inserts on profiles.AFTER INSERT)
-- Actually the existing flow uses trg_on_profile_created which fires after profile insert.
-- We need a trigger on auth.users to seed the profile from raw_user_meta_data.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, username, age, location, referral_source)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'username',
    NULLIF(NEW.raw_user_meta_data ->> 'age','')::int,
    NEW.raw_user_meta_data ->> 'location',
    NEW.raw_user_meta_data ->> 'referral_source'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    age = COALESCE(EXCLUDED.age, public.profiles.age),
    location = COALESCE(EXCLUDED.location, public.profiles.location),
    referral_source = COALESCE(EXCLUDED.referral_source, public.profiles.referral_source);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
