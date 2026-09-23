-- 1. Tournament type (turf / open_ground)
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS tournament_type TEXT NOT NULL DEFAULT 'open_ground';

-- 2. Platform admin helper
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) = 'ritesshhh19@gmail.com'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, anon;

-- 3. Give the platform admin the super_admin role (now and on future signup)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'ritesshhh19@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. On tournament insert, platform admin skips the payment gate entirely
CREATE OR REPLACE FUNCTION public.apply_admin_payment_bypass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.is_platform_admin(NEW.owner_id) THEN
    NEW.status := 'active'::tournament_status;
    NEW.payment_status := 'approved'::payment_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_payment_bypass ON public.tournaments;
CREATE TRIGGER trg_admin_payment_bypass
BEFORE INSERT ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.apply_admin_payment_bypass();