-- First, clean up any problematic data
DELETE FROM auth.identities WHERE provider_id IS NULL OR provider_id = '';

-- Create a function to properly handle user creation and auth
CREATE OR REPLACE FUNCTION create_user_and_submit_application(
  p_email text,
  p_password text,
  p_data jsonb,
  p_linked_name text DEFAULT NULL,
  p_linked_email text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_application applications;
BEGIN
  -- Generate user ID
  v_user_id := gen_random_uuid();

  -- Create the user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    now(),
    now(),
    encode(gen_random_bytes(32), 'base64'),
    encode(gen_random_bytes(32), 'base64'),
    encode(gen_random_bytes(32), 'base64'),
    false
  );

  -- Create identity record
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    p_email,
    'email',
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', p_email,
      'email_verified', true,
      'provider', 'email'
    ),
    now(),
    now(),
    now()
  );

  -- Create profile
  INSERT INTO profiles (id, email)
  VALUES (v_user_id, p_email);

  -- Submit application
  INSERT INTO applications (
    user_id,
    data,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_data,
    'pending',
    now(),
    now()
  )
  RETURNING * INTO v_application;

  -- Handle linked application if provided
  IF p_linked_name IS NOT NULL AND p_linked_email IS NOT NULL THEN
    INSERT INTO linked_applications (
      primary_application_id,
      linked_name,
      linked_email,
      created_at
    ) VALUES (
      v_application.id,
      p_linked_name,
      p_linked_email,
      now()
    );
  END IF;

  -- Remove from whitelist if they were on it
  DELETE FROM whitelist WHERE email = p_email;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'application_id', v_application.id
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Email already exists';
  WHEN others THEN
    RAISE EXCEPTION 'Failed to create user/application: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to handle application approval
CREATE OR REPLACE FUNCTION approve_application(
  p_application_id uuid
) RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  -- Get the user_id and email from the application
  SELECT a.user_id, u.email INTO v_user_id, v_email
  FROM applications a
  JOIN auth.users u ON a.user_id = u.id
  WHERE a.id = p_application_id;

  -- Update application status
  UPDATE applications
  SET 
    status = 'approved',
    updated_at = now()
  WHERE id = p_application_id;

  -- Ensure user is properly set up in auth system
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email']
    ),
    raw_user_meta_data = '{}'::jsonb,
    aud = 'authenticated',
    role = 'authenticated',
    updated_at = now()
  WHERE id = v_user_id;

  -- Ensure user has proper identity record
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_email,
    'email',
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'provider', 'email'
    ),
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) 
  DO UPDATE SET 
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  -- Remove from whitelist if they were on it
  DELETE FROM whitelist 
  WHERE user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix existing users
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Fix all approved applications
  FOR r IN 
    SELECT a.id 
    FROM applications a 
    WHERE a.status = 'approved'
  LOOP
    PERFORM approve_application(r.id);
  END LOOP;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_and_submit_application TO anon;
GRANT EXECUTE ON FUNCTION create_user_and_submit_application TO authenticated;
GRANT EXECUTE ON FUNCTION approve_application TO authenticated;