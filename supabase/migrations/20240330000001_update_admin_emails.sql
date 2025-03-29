-- Drop existing is_admin function
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Create updated is_admin function with all admin emails
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
      'samjlloa@gmail.com'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated; 