// src/components/AuthCallback.tsx
import { useEffect } from 'react';
// import { useNavigate } from 'react-router-dom'; // No longer needed
// import { useSession } from '../hooks/useSession'; // No longer needed

export function AuthCallback() {
  // const navigate = useNavigate(); // No longer needed here
  // const session = useSession(); // No longer needed here

  // Remove the useEffect hook entirely as App.tsx now handles the redirect
  // useEffect(() => {
  //   console.log('AuthCallback: useEffect running.');
  //   console.log('AuthCallback: Checking session state...');
  //   if (session) {
  //     console.log('AuthCallback: Session detected, navigating to /');
  //     navigate('/', { replace: true }); 
  //   } else {
  //     console.log('AuthCallback: No session yet, waiting...');
  //   }
  // }, [session, navigate]); 

  // This component now just shows a loading state briefly
  // before the redirect in App.tsx takes effect.
  console.log('AuthCallback: Rendering minimal loading indicator.'); 
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-display font-light text-stone-900 mb-4">Completing sign in...</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-900 mx-auto"></div>
      </div>
    </div>
  );
} 