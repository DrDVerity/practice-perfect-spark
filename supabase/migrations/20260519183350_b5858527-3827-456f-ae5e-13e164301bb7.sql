
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@test.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'admin@test.com', crypt('Admin2026$', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@test.com', 'email_verified', true),
      'email', v_user_id::text, now(), now(), now());
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('Admin2026$', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (user_id, email) VALUES (v_user_id, 'admin@test.com')
  ON CONFLICT DO NOTHING;
END $$;
