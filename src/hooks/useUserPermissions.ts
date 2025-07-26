import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { isAdminUser, hasHousekeepingAccess } from '../lib/authUtils';

interface UserPermissions {
  isAdmin: boolean;
  hasHousekeeping: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to manage user permissions (admin and housekeeping access)
 * Handles async permission checks with proper loading states
 */
export function useUserPermissions(session: Session | null): UserPermissions {
  // console.log('🔍 [useUserPermissions] HOOK CALLED', { hasSession: !!session, userId: session?.user?.id, userEmail: session?.user?.email });

  const [permissions, setPermissions] = useState<UserPermissions>({
    isAdmin: false,
    hasHousekeeping: false,
    isLoading: true,
    error: null
  });

  // Extract primitive values directly to avoid object reference issues
  const userId = session?.user?.id || null;
  const userEmail = session?.user?.email || null;

  useEffect(() => {
    let mounted = true;

    const checkPermissions = async () => {
      // console.log('[useUserPermissions] checkPermissions called', { userId, userEmail, hasSession: !!session });

      if (!userId || !userEmail) {
        // console.log('[useUserPermissions] No user ID or email, setting not loading');
        if (mounted) {
          setPermissions({
            isAdmin: false,
            hasHousekeeping: false,
            isLoading: false,
            error: null
          });
        }
        return;
      }

      try {
        // console.log('[useUserPermissions] Setting loading=true, starting permission check');
        setPermissions(prev => ({ ...prev, isLoading: true, error: null }));

        // Check both permissions in parallel
        const [adminResult, housekeepingResult] = await Promise.all([
          isAdminUser(session),
          hasHousekeepingAccess(session)
        ]);

        if (mounted) {
          // console.log('[useUserPermissions] Permission check complete', { adminResult, housekeepingResult });
          setPermissions({
            isAdmin: adminResult,
            hasHousekeeping: housekeepingResult,
            isLoading: false,
            error: null
          });
        }
      } catch (err) {
        console.error('[useUserPermissions] Error checking permissions:', err);
        if (mounted) {
          setPermissions({
            isAdmin: false,
            hasHousekeeping: false,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to check permissions'
          });
        }
      }
    };

    checkPermissions();

    return () => {
      mounted = false;
    };
  }, [userId, userEmail]); // Use primitive values directly

  return permissions;
} 