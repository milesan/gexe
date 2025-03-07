CREATE OR REPLACE FUNCTION public.is_whitelisted(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Log function start for debugging
  RAISE NOTICE 'Checking whitelist status for email: %', user_email;

  -- Check if the email exists in the whitelist table
  IF EXISTS (
    SELECT 1
    FROM public.whitelist
    WHERE email = user_email
  ) THEN
    RAISE NOTICE 'Email % found in whitelist', user_email;
    RETURN true;
  ELSE
    RAISE NOTICE 'Email % not found in whitelist', user_email;
    RETURN false;
  END IF;
END;
$function$;


                                                                                                                                                                                                                                                                               
| CREATE OR REPLACE FUNCTION public.check_whitelist_status_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE NOTICE 'check_whitelist_status_trigger: email=%, user_id=%, op=%', NEW.email, NEW.id, TG_OP;
  -- Placeholder: assume it checks or inserts into whitelist
  INSERT INTO whitelist (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'check_whitelist_status_trigger: whitelist insert attempted';
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'check_whitelist_status_trigger error: %', SQLERRM;
    RETURN NEW;
END;
$function$
 |




| CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ BEGIN INSERT INTO public.profiles (id, email, credits) VALUES (NEW.id, NEW.email, 1000) ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $function$
 |


