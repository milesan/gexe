-- Update is_admin function to include all admin emails
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE id = auth.uid() 
    AND email IN (
      'andre@thegarden.pt',
      'redis213@gmail.com',
      'dawn@thegarden.pt',
      'simone@thegarden.pt',
      'samjlloa@gmail.com',
      'living@thegarden.pt'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create housekeeping access function
CREATE OR REPLACE FUNCTION public.has_housekeeping_access()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 
      FROM auth.users 
      WHERE id = auth.uid() 
      AND email IN (
        'solarlovesong@gmail.com',
        'samckclarke@gmail.com',
        'redis213+testtest@gmail.com'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_housekeeping_access() TO authenticated; 