-- Update is_admin function to only check for is_admin flag
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 
      FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'is_admin')::boolean = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 