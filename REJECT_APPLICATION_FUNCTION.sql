CREATE OR REPLACE FUNCTION public.reject_application(p_application_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 -- SECURITY DEFINER -- Temporarily removed for testing
 SET search_path = public
AS $function$
BEGIN
  -- Test: Can we log anything at all?
  RAISE NOTICE 'reject_application: TEST LOGGING FOR application ID %', p_application_id;
END;
$function$