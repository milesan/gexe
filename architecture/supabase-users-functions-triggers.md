[
  {
    "schema_name": "pgbouncer",
    "function_name": "get_auth",
    "function_definition": "CREATE OR REPLACE FUNCTION pgbouncer.get_auth(p_usename text)\n RETURNS TABLE(username text, password text)\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n    RAISE WARNING 'PgBouncer auth request: %', p_usename;\n\n    RETURN QUERY\n    SELECT usename::TEXT, passwd::TEXT FROM pg_catalog.pg_shadow\n    WHERE usename = p_usename;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "save_application_data",
    "function_definition": "CREATE OR REPLACE FUNCTION public.save_application_data(p_data jsonb)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  INSERT INTO saved_applications (user_id, data)\n  VALUES (auth.uid(), p_data)\n  ON CONFLICT (user_id) \n  DO UPDATE SET \n    data = EXCLUDED.data,\n    updated_at = now();\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "is_whitelisted",
    "function_definition": "CREATE OR REPLACE FUNCTION public.is_whitelisted(p_email text)\n RETURNS boolean\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  RETURN EXISTS (\n    SELECT 1 FROM whitelist WHERE email = p_email\n  );\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "create_profile",
    "function_definition": "CREATE OR REPLACE FUNCTION public.create_profile()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  INSERT INTO public.profiles (id, email, credits)\n  VALUES (NEW.id, NEW.email, 1000);\n  RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "verify_acceptance_token",
    "function_definition": "CREATE OR REPLACE FUNCTION public.verify_acceptance_token(token_to_verify text)\n RETURNS uuid\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\r\nDECLARE\r\n    app_id uuid;\r\nBEGIN\r\n    UPDATE acceptance_tokens\r\n    SET used_at = now()\r\n    WHERE token = token_to_verify\r\n    AND used_at IS NULL\r\n    AND expires_at > now()\r\n    RETURNING application_id INTO app_id;\r\n    \r\n    RETURN app_id;\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha512_keygen",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha512_keygen()\n RETURNS bytea\n LANGUAGE c\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_hmacsha512_keygen$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_keygen",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_keygen()\n RETURNS bytea\n LANGUAGE c\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_keygen$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha256_keygen",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha256_keygen()\n RETURNS bytea\n LANGUAGE c\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_hmacsha256_keygen$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "ensure_proper_auth_setup",
    "function_definition": "CREATE OR REPLACE FUNCTION public.ensure_proper_auth_setup()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  -- Ensure proper identity record exists\n  INSERT INTO auth.identities (\n    provider_id,\n    user_id,\n    identity_data,\n    provider,\n    last_sign_in_at,\n    created_at,\n    updated_at\n  )\n  VALUES (\n    NEW.email,\n    NEW.id,\n    jsonb_build_object(\n      'sub', NEW.id::text,\n      'email', NEW.email,\n      'email_verified', true,\n      'provider', 'email'\n    ),\n    'email',\n    now(),\n    now(),\n    now()\n  )\n  ON CONFLICT (provider, provider_id) DO NOTHING;\n\n  RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "check_user_approved",
    "function_definition": "CREATE OR REPLACE FUNCTION public.check_user_approved()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM approved_users \n    WHERE email = NEW.email\n  ) THEN\n    RAISE EXCEPTION 'User not approved';\n  END IF;\n  RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "handle_new_user",
    "function_definition": "CREATE OR REPLACE FUNCTION public.handle_new_user()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\r\nBEGIN\r\n  IF NEW.email_confirmed_at IS NOT NULL THEN\r\n    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN\r\n      BEGIN\r\n        INSERT INTO public.profiles (id, email, credits)\r\n        VALUES (NEW.id, NEW.email, 1000);\r\n      EXCEPTION WHEN OTHERS THEN\r\n        RAISE NOTICE 'Could not create profile for %: %', NEW.id, SQLERRM;\r\n      END;\r\n    ELSE\r\n      RAISE NOTICE 'Profile already exists for %', NEW.id;\r\n    END IF;\r\n  ELSE\r\n    RAISE NOTICE 'Skipping profile creation for unconfirmed user %', NEW.id;\r\n  END IF;\r\n  RETURN NEW;\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "set_user_metadata",
    "function_definition": "CREATE OR REPLACE FUNCTION public.set_user_metadata()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\r\nBEGIN\r\n  NEW.raw_app_meta_data := jsonb_build_object(\r\n    'provider', 'email',\r\n    'providers', array['email']\r\n  );\r\n  IF NEW.email = 'andre@thegarden.pt' THEN\r\n    NEW.raw_user_meta_data := jsonb_build_object(\r\n      'is_admin', true,\r\n      'application_status', 'approved',\r\n      'has_applied', true\r\n    );\r\n    NEW.email_confirmed_at := now();\r\n  ELSE\r\n    NEW.raw_user_meta_data := jsonb_build_object(\r\n      'has_applied', false,\r\n      'application_status', null\r\n    );\r\n  END IF;\r\n  RETURN NEW;\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "ensure_user_identity",
    "function_definition": "CREATE OR REPLACE FUNCTION public.ensure_user_identity()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  -- Create identity record if it doesn't exist\n  INSERT INTO auth.identities (\n    id,\n    provider_id,\n    user_id,\n    identity_data,\n    provider,\n    last_sign_in_at,\n    created_at,\n    updated_at\n  ) VALUES (\n    gen_random_uuid(),\n    NEW.email,\n    NEW.id,\n    jsonb_build_object(\n      'sub', NEW.id::text,\n      'email', NEW.email,\n      'email_verified', true,\n      'provider', 'email'\n    ),\n    'email',\n    now(),\n    now(),\n    now()\n  )\n  ON CONFLICT (provider, provider_id) DO NOTHING;\n\n  RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "verify_and_use_whitelist_token",
    "function_definition": "CREATE OR REPLACE FUNCTION public.verify_and_use_whitelist_token(p_token text, p_current_time timestamp with time zone)\n RETURNS TABLE(token_id uuid, whitelist_id uuid, email text, expires_at timestamp with time zone)\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\r\nDECLARE\r\n  v_token_record RECORD;\r\nBEGIN\r\n  -- Lock the token row for update to prevent concurrent access\r\n  SELECT \r\n    wt.id as token_id,\r\n    wt.whitelist_id,\r\n    w.email,\r\n    wt.expires_at,\r\n    wt.used_at\r\n  INTO v_token_record\r\n  FROM whitelist_tokens wt\r\n  JOIN whitelist w ON w.id = wt.whitelist_id\r\n  WHERE wt.token = p_token\r\n  FOR UPDATE;\r\n\r\n  IF NOT FOUND THEN\r\n    RAISE EXCEPTION 'Invalid token';\r\n  END IF;\r\n\r\n  IF v_token_record.used_at IS NOT NULL THEN\r\n    RAISE EXCEPTION 'Token has already been used';\r\n  END IF;\r\n\r\n  IF v_token_record.expires_at < p_current_time THEN\r\n    RAISE EXCEPTION 'Token has expired';\r\n  END IF;\r\n\r\n  IF v_token_record.email IS NULL THEN\r\n    RAISE EXCEPTION 'No email associated with this token';\r\n  END IF;\r\n\r\n  -- Mark token as used\r\n  UPDATE whitelist_tokens\r\n  SET used_at = p_current_time\r\n  WHERE id = v_token_record.token_id;\r\n\r\n  -- Update whitelist entry\r\n  UPDATE whitelist\r\n  SET has_created_account = true,\r\n      created_account_at = p_current_time\r\n  WHERE id = v_token_record.whitelist_id;\r\n\r\n  RETURN QUERY\r\n  SELECT \r\n    v_token_record.token_id,\r\n    v_token_record.whitelist_id,\r\n    v_token_record.email,\r\n    v_token_record.expires_at;\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth(message bytea, key bytea)\n RETURNS bytea\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth(message bytea, key_id bigint, context bytea DEFAULT '\\x7067736f6469756d'::bytea)\n RETURNS bytea\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_by_id$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth(message bytea, key_uuid uuid)\n RETURNS bytea\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO ''\nAS $function$\nDECLARE\n  key pgsodium.decrypted_key;\nBEGIN\n  SELECT * INTO STRICT key\n    FROM pgsodium.decrypted_key v\n  WHERE id = key_uuid AND key_type = 'auth';\n\n  IF key.decrypted_raw_key IS NOT NULL THEN\n    RETURN pgsodium.crypto_auth(message, key.decrypted_raw_key);\n  END IF;\n  RETURN pgsodium.crypto_auth(message, key.key_id, key.key_context);\nEND;\n\n$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_verify(mac bytea, message bytea, key bytea)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_verify$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_verify(mac bytea, message bytea, key_id bigint, context bytea DEFAULT '\\x7067736f6469756d'::bytea)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_verify_by_id$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_verify(mac bytea, message bytea, key_uuid uuid)\n RETURNS boolean\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO ''\nAS $function$\nDECLARE\n  key pgsodium.decrypted_key;\nBEGIN\n  SELECT * INTO STRICT key\n    FROM pgsodium.decrypted_key v\n  WHERE id = key_uuid AND key_type = 'auth';\n\n  IF key.decrypted_raw_key IS NOT NULL THEN\n    RETURN pgsodium.crypto_auth_verify(mac, message, key.decrypted_raw_key);\n  END IF;\n  RETURN pgsodium.crypto_auth_verify(mac, message, key.key_id, key.key_context);\nEND;\n\n$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha512",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha512(message bytea, secret bytea)\n RETURNS bytea\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_hmacsha512$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha512",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha512(message bytea, key_id bigint, context bytea DEFAULT '\\x7067736f6469756d'::bytea)\n RETURNS bytea\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_hmacsha512_by_id$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha512",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha512(message bytea, key_uuid uuid)\n RETURNS bytea\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO ''\nAS $function$\nDECLARE\n  key pgsodium.decrypted_key;\nBEGIN\n  SELECT * INTO STRICT key\n    FROM pgsodium.decrypted_key v\n  WHERE id = key_uuid AND key_type = 'hmacsha512';\n\n  IF key.decrypted_raw_key IS NOT NULL THEN\n    RETURN pgsodium.crypto_auth_hmacsha512(message, key.decrypted_raw_key);\n  END IF;\n  RETURN pgsodium.crypto_auth_hmacsha512(message, key.key_id, key.key_context);\nEND;\n\n$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha512_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha512_verify(hash bytea, message bytea, secret bytea)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_hmacsha512_verify$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha512_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha512_verify(hash bytea, message bytea, key_id bigint, context bytea DEFAULT '\\x7067736f6469756d'::bytea)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_hmacsha512_verify_by_id$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha512_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha512_verify(signature bytea, message bytea, key_uuid uuid)\n RETURNS boolean\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO ''\nAS $function$\nDECLARE\n  key pgsodium.decrypted_key;\nBEGIN\n  SELECT * INTO STRICT key\n    FROM pgsodium.decrypted_key v\n  WHERE id = key_uuid AND key_type = 'hmacsha512';\n\n  IF key.decrypted_raw_key IS NOT NULL THEN\n    RETURN pgsodium.crypto_auth_hmacsha512_verify(signature, message, key.decrypted_raw_key);\n  END IF;\n  RETURN pgsodium.crypto_auth_hmacsha512_verify(signature, message, key.key_id, key.key_context);\nEND;\n\n$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha256",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha256(message bytea, secret bytea)\n RETURNS bytea\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_hmacsha256$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha256",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha256(message bytea, key_id bigint, context bytea DEFAULT '\\x7067736f6469756d'::bytea)\n RETURNS bytea\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_hmacsha256_by_id$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha256",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha256(message bytea, key_uuid uuid)\n RETURNS bytea\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO ''\nAS $function$\nDECLARE\n  key pgsodium.decrypted_key;\nBEGIN\n  SELECT * INTO STRICT key\n    FROM pgsodium.decrypted_key v\n  WHERE id = key_uuid AND key_type = 'hmacsha256';\n\n  IF key.decrypted_raw_key IS NOT NULL THEN\n    RETURN pgsodium.crypto_auth_hmacsha256(message, key.decrypted_raw_key);\n  END IF;\n  RETURN pgsodium.crypto_auth_hmacsha256(message, key.key_id, key.key_context);\nEND;\n\n$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha256_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha256_verify(hash bytea, message bytea, secret bytea)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_hmacsha256_verify$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha256_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha256_verify(hash bytea, message bytea, key_id bigint, context bytea DEFAULT '\\x7067736f6469756d'::bytea)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_auth_hmacsha256_verify_by_id$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_auth_hmacsha256_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_auth_hmacsha256_verify(signature bytea, message bytea, key_uuid uuid)\n RETURNS boolean\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO ''\nAS $function$\nDECLARE\n  key pgsodium.decrypted_key;\nBEGIN\n  SELECT * INTO STRICT key\n    FROM pgsodium.decrypted_key v\n  WHERE id = key_uuid AND key_type = 'hmacsha256';\n\n  IF key.decrypted_raw_key IS NOT NULL THEN\n    RETURN pgsodium.crypto_auth_hmacsha256_verify(signature, message, key.decrypted_raw_key);\n  END IF;\n  RETURN pgsodium.crypto_auth_hmacsha256_verify(signature, message, key.key_id, key.key_context);\nEND;\n\n$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_pwhash_str_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_pwhash_str_verify(hashed_password bytea, password bytea)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_pwhash_str_verify$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_sign_final_verify",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_sign_final_verify(state bytea, signature bytea, key bytea)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_sign_final_verify$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_sign_verify_detached",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_sign_verify_detached(sig bytea, message bytea, key bytea)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE\nAS '$libdir/pgsodium', $function$pgsodium_crypto_sign_verify_detached$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_signcrypt_verify_after",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_signcrypt_verify_after(state bytea, signature bytea, sender_pk bytea, ciphertext bytea)\n RETURNS boolean\n LANGUAGE c\nAS '$libdir/pgsodium', $function$pgsodium_crypto_signcrypt_verify_after$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_signcrypt_verify_before",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_signcrypt_verify_before(signature bytea, sender bytea, recipient bytea, additional bytea, sender_pk bytea, recipient_sk bytea)\n RETURNS pgsodium.crypto_signcrypt_state_key\n LANGUAGE c\nAS '$libdir/pgsodium', $function$pgsodium_crypto_signcrypt_verify_before$function$\n"
  },
  {
    "schema_name": "pgsodium",
    "function_name": "crypto_signcrypt_verify_public",
    "function_definition": "CREATE OR REPLACE FUNCTION pgsodium.crypto_signcrypt_verify_public(signature bytea, sender bytea, recipient bytea, additional bytea, sender_pk bytea, ciphertext bytea)\n RETURNS boolean\n LANGUAGE c\nAS '$libdir/pgsodium', $function$pgsodium_crypto_signcrypt_verify_public$function$\n"
  },
  {
    "schema_name": "extensions",
    "function_name": "verify",
    "function_definition": "CREATE OR REPLACE FUNCTION extensions.verify(token text, secret text, algorithm text DEFAULT 'HS256'::text)\n RETURNS TABLE(header json, payload json, valid boolean)\n LANGUAGE sql\n IMMUTABLE\nAS $function$\n  SELECT\n    jwt.header AS header,\n    jwt.payload AS payload,\n    jwt.signature_ok AND tstzrange(\n      to_timestamp(extensions.try_cast_double(jwt.payload->>'nbf')),\n      to_timestamp(extensions.try_cast_double(jwt.payload->>'exp'))\n    ) @> CURRENT_TIMESTAMP AS valid\n  FROM (\n    SELECT\n      convert_from(extensions.url_decode(r[1]), 'utf8')::json AS header,\n      convert_from(extensions.url_decode(r[2]), 'utf8')::json AS payload,\n      r[3] = extensions.algorithm_sign(r[1] || '.' || r[2], secret, algorithm) AS signature_ok\n    FROM regexp_split_to_array(token, '\\.') r\n  ) jwt\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "update_application_on_whitelist",
    "function_definition": "CREATE OR REPLACE FUNCTION public.update_application_on_whitelist()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\r\nBEGIN\r\n  RAISE NOTICE 'update_application_on_whitelist: email=%, op=%', NEW.email, TG_OP;\r\n  UPDATE applications a\r\n  SET status = 'approved'\r\n  FROM auth.users u\r\n  WHERE a.user_id = u.id\r\n    AND u.email = NEW.email\r\n    AND a.status = 'pending';\r\n  RAISE NOTICE 'update_application_on_whitelist: rows updated=%', FOUND;\r\n  RETURN NEW;\r\nEXCEPTION\r\n  WHEN OTHERS THEN\r\n    RAISE NOTICE 'update_application_on_whitelist error: %', SQLERRM;\r\n    RETURN NEW;\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "update_user_whitelist_status",
    "function_definition": "CREATE OR REPLACE FUNCTION public.update_user_whitelist_status(user_id uuid)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\r\nDECLARE\r\n  is_in_whitelist boolean;\r\n  user_record RECORD;\r\nBEGIN\r\n  -- Get the user record\r\n  SELECT * FROM auth.users\r\n  WHERE id = user_id\r\n  INTO user_record;\r\n\r\n  -- Check if the user's email is in the whitelist\r\n  SELECT EXISTS (\r\n    SELECT 1 FROM whitelist w\r\n    WHERE w.email = user_record.email\r\n  ) INTO is_in_whitelist;\r\n\r\n  -- If user is whitelisted but metadata doesn't reflect this, update it\r\n  IF is_in_whitelist AND \r\n     (user_record.raw_user_meta_data->>'is_whitelisted' IS NULL OR \r\n      user_record.raw_user_meta_data->>'is_whitelisted' = 'false') THEN\r\n    \r\n    -- Update user metadata to include whitelisted status\r\n    UPDATE auth.users\r\n    SET raw_user_meta_data = \r\n      CASE \r\n        WHEN raw_user_meta_data IS NULL THEN \r\n          jsonb_build_object('is_whitelisted', true)\r\n        ELSE\r\n          raw_user_meta_data || jsonb_build_object('is_whitelisted', true)\r\n      END\r\n    WHERE id = user_id;\r\n  END IF;\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "auth",
    "function_name": "check_user_approved",
    "function_definition": "CREATE OR REPLACE FUNCTION auth.check_user_approved()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  IF NOT (NEW.raw_user_meta_data->>'approved')::boolean THEN\n    RAISE EXCEPTION 'User not approved';\n  END IF;\n  RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "get_whitelist_status",
    "function_definition": "CREATE OR REPLACE FUNCTION public.get_whitelist_status()\n RETURNS boolean\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\r\nBEGIN\r\n  RETURN EXISTS (\r\n    SELECT 1 FROM whitelist w\r\n    WHERE w.email = auth.email()\r\n  );\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "check_whitelist_status_trigger",
    "function_definition": "CREATE OR REPLACE FUNCTION public.check_whitelist_status_trigger()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\r\nBEGIN\r\n  RAISE NOTICE 'check_whitelist_status_trigger: email=%, user_id=%, op=%', NEW.email, NEW.id, TG_OP;\r\n  -- Placeholder: assume it checks or inserts into whitelist\r\n  INSERT INTO whitelist (user_id, email)\r\n  VALUES (NEW.id, NEW.email)\r\n  ON CONFLICT DO NOTHING;\r\n  RAISE NOTICE 'check_whitelist_status_trigger: whitelist insert attempted';\r\n  RETURN NEW;\r\nEXCEPTION\r\n  WHEN OTHERS THEN\r\n    RAISE NOTICE 'check_whitelist_status_trigger error: %', SQLERRM;\r\n    RETURN NEW;\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "extensions",
    "function_name": "auth0_fdw_validator",
    "function_definition": "CREATE OR REPLACE FUNCTION extensions.auth0_fdw_validator(options text[], catalog oid)\n RETURNS void\n LANGUAGE c\nAS '$libdir/wrappers', $function$auth0_fdw_validator_wrapper$function$\n"
  },
  {
    "schema_name": "extensions",
    "function_name": "auth0_fdw_meta",
    "function_definition": "CREATE OR REPLACE FUNCTION extensions.auth0_fdw_meta()\n RETURNS TABLE(name text, version text, author text, website text)\n LANGUAGE c\n STRICT\nAS '$libdir/wrappers', $function$auth0_fdw_meta_wrapper$function$\n"
  },
  {
    "schema_name": "extensions",
    "function_name": "auth0_fdw_handler",
    "function_definition": "CREATE OR REPLACE FUNCTION extensions.auth0_fdw_handler()\n RETURNS fdw_handler\n LANGUAGE c\n STRICT\nAS '$libdir/wrappers', $function$auth0_fdw_handler_wrapper$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "maintain_user_auth",
    "function_definition": "CREATE OR REPLACE FUNCTION public.maintain_user_auth()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nDECLARE\n  v_user_email text;\nBEGIN\n  -- Only proceed if status is changing to approved\n  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status != 'approved' THEN\n    -- Get user email\n    SELECT email INTO v_user_email\n    FROM auth.users\n    WHERE id = NEW.user_id;\n\n    -- Update user auth setup\n    UPDATE auth.users\n    SET \n      raw_app_meta_data = jsonb_build_object(\n        'provider', 'email',\n        'providers', ARRAY['email']\n      ),\n      raw_user_meta_data = jsonb_build_object('approved', true),\n      aud = 'authenticated',\n      role = 'authenticated',\n      email_confirmed_at = COALESCE(email_confirmed_at, now()),\n      updated_at = now()\n    WHERE id = NEW.user_id;\n\n    -- Ensure proper identity record exists\n    INSERT INTO auth.identities (\n      id,\n      user_id,\n      provider_id,\n      provider,\n      identity_data,\n      last_sign_in_at,\n      created_at,\n      updated_at\n    ) VALUES (\n      gen_random_uuid(),\n      NEW.user_id,\n      v_user_email,  -- Use email as provider_id\n      'email',\n      jsonb_build_object(\n        'sub', NEW.user_id::text,\n        'email', v_user_email,\n        'email_verified', true,\n        'provider', 'email'\n      ),\n      now(),\n      now(),\n      now()\n    )\n    ON CONFLICT (provider, provider_id) DO UPDATE\n    SET \n      identity_data = EXCLUDED.identity_data,\n      updated_at = now();\n  END IF;\n  RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "mark_whitelist_welcome_seen",
    "function_definition": "CREATE OR REPLACE FUNCTION public.mark_whitelist_welcome_seen(p_email text)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  UPDATE whitelist\n  SET \n    has_seen_welcome = true,\n    updated_at = now()\n  WHERE email = p_email;\n\n  -- Also update user metadata\n  UPDATE auth.users\n  SET raw_user_meta_data = raw_user_meta_data || \n    jsonb_build_object('has_seen_welcome', true)\n  WHERE email = p_email;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "check_whitelist_welcome",
    "function_definition": "CREATE OR REPLACE FUNCTION public.check_whitelist_welcome(p_email text)\n RETURNS boolean\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  RETURN EXISTS (\n    SELECT 1 FROM whitelist \n    WHERE email = p_email \n    AND has_seen_welcome = false\n  );\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "reject_application",
    "function_definition": "CREATE OR REPLACE FUNCTION public.reject_application(p_application_id uuid)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  -- Update application status to rejected\n  UPDATE applications\n  SET \n    status = 'rejected',\n    updated_at = now()\n  WHERE id = p_application_id;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "approve_application",
    "function_definition": "CREATE OR REPLACE FUNCTION public.approve_application(p_application_id uuid)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nDECLARE\n  v_user_id uuid;\n  v_email text;\nBEGIN\n  -- Get the user_id and email from the application\n  SELECT a.user_id, u.email INTO v_user_id, v_email\n  FROM applications a\n  JOIN auth.users u ON a.user_id = u.id\n  WHERE a.id = p_application_id;\n\n  IF NOT FOUND THEN\n    RAISE EXCEPTION 'Application not found';\n  END IF;\n\n  -- Update application status\n  UPDATE applications\n  SET \n    status = 'approved',\n    updated_at = now()\n  WHERE id = p_application_id;\n\n  -- Update user metadata and confirm email\n  UPDATE auth.users\n  SET \n    email_confirmed_at = COALESCE(email_confirmed_at, now()),\n    raw_app_meta_data = jsonb_build_object(\n      'provider', 'email',\n      'providers', ARRAY['email']\n    ),\n    raw_user_meta_data = jsonb_build_object(\n      'approved', true,\n      'has_applied', true,\n      'application_status', 'approved'\n    ),\n    updated_at = now()\n  WHERE id = v_user_id;\n\n  -- Ensure proper identity record exists\n  INSERT INTO auth.identities (\n    id,\n    user_id,\n    provider_id,\n    provider,\n    identity_data,\n    last_sign_in_at,\n    created_at,\n    updated_at\n  )\n  VALUES (\n    gen_random_uuid(),\n    v_user_id,\n    v_email,\n    'email',\n    jsonb_build_object(\n      'sub', v_user_id::text,\n      'email', v_email,\n      'email_verified', true,\n      'provider', 'email'\n    ),\n    now(),\n    now(),\n    now()\n  )\n  ON CONFLICT (provider, provider_id) DO UPDATE\n  SET \n    identity_data = EXCLUDED.identity_data,\n    updated_at = now();\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "handle_allowlisted_user",
    "function_definition": "CREATE OR REPLACE FUNCTION public.handle_allowlisted_user()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  -- Check if user is allowlisted\n  IF EXISTS (SELECT 1 FROM allowlist WHERE email = NEW.email) THEN\n    -- Set metadata for allowlisted users\n    NEW.raw_user_meta_data = jsonb_build_object(\n      'is_allowlisted', true,\n      'has_seen_welcome', false,\n      'application_status', 'approved',\n      'has_applied', true  -- This ensures they bypass RetroApp\n    );\n    NEW.email_confirmed_at = now();\n    \n    -- Update allowlist record\n    UPDATE allowlist \n    SET \n      last_login = now(),\n      has_created_account = true,\n      account_created_at = now()\n    WHERE email = NEW.email;\n  ELSE\n    -- Set default metadata for non-allowlisted users\n    NEW.raw_user_meta_data = jsonb_build_object(\n      'is_allowlisted', false,\n      'has_applied', false,\n      'application_status', null\n    );\n  END IF;\n\n  -- Special case for admin\n  IF NEW.email = 'andre@thegarden.pt' THEN\n    NEW.raw_user_meta_data = NEW.raw_user_meta_data || \n      jsonb_build_object('is_admin', true);\n  END IF;\n\n  RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "create_profile_for_user",
    "function_definition": "CREATE OR REPLACE FUNCTION public.create_profile_for_user()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  INSERT INTO public.profiles (id, email, credits)\n  VALUES (NEW.id, NEW.email, 1000)\n  ON CONFLICT (id) DO NOTHING;\n  RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "check_whitelist_status",
    "function_definition": "CREATE OR REPLACE FUNCTION public.check_whitelist_status(p_email text)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nDECLARE\n  v_whitelist_entry whitelist;\nBEGIN\n  -- Get whitelist entry\n  SELECT * INTO v_whitelist_entry\n  FROM whitelist\n  WHERE email = p_email;\n\n  IF NOT FOUND THEN\n    RETURN jsonb_build_object(\n      'is_whitelisted', false\n    );\n  END IF;\n\n  -- Update last login and account status\n  UPDATE whitelist\n  SET \n    last_login = now(),\n    has_created_account = true,\n    account_created_at = COALESCE(account_created_at, now()),\n    updated_at = now()\n  WHERE id = v_whitelist_entry.id;\n\n  -- Update user metadata\n  UPDATE auth.users\n  SET \n    raw_user_meta_data = jsonb_build_object(\n      'is_whitelisted', true,\n      'has_seen_welcome', false,\n      'application_status', 'approved',\n      'has_applied', true\n    ),\n    email_confirmed_at = now()\n  WHERE email = p_email;\n\n  RETURN jsonb_build_object(\n    'is_whitelisted', true,\n    'has_seen_welcome', v_whitelist_entry.has_seen_welcome\n  );\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "update_whitelist_tracking",
    "function_definition": "CREATE OR REPLACE FUNCTION public.update_whitelist_tracking()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  -- Update whitelist entry when a booking is created\n  IF TG_OP = 'INSERT' THEN\n    UPDATE whitelist w\n    SET \n      has_booked = true,\n      first_booking_at = COALESCE(w.first_booking_at, NEW.created_at),\n      last_booking_at = NEW.created_at,\n      total_bookings = COALESCE(w.total_bookings, 0) + 1,\n      updated_at = now()\n    FROM auth.users u\n    WHERE u.id = NEW.user_id\n    AND w.email = u.email;\n  END IF;\n  RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "auth",
    "function_name": "on_auth_user_created",
    "function_definition": "CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()"
  },
  {
    "schema_name": "auth",
    "function_name": "on_auth_user_metadata",
    "function_definition": "CREATE TRIGGER on_auth_user_metadata BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION set_user_metadata()"
  },
  {
    "schema_name": "public",
    "function_name": "whitelist_application_update",
    "function_definition": "CREATE TRIGGER whitelist_application_update AFTER INSERT ON public.whitelist FOR EACH ROW EXECUTE FUNCTION update_application_on_whitelist()"
  },
  {
    "schema_name": "auth",
    "function_name": "check_whitelist_on_auth",
    "function_definition": "CREATE TRIGGER check_whitelist_on_auth AFTER INSERT OR UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION check_whitelist_status_trigger()"
  }
]