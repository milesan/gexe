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
  const [permissions, setPermissions] = useState<UserPermissions>({
    isAdmin: false,
    hasHousekeeping: false,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    let mounted = true;

    const checkPermissions = async () => {
      if (!session?.user?.email) {
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
        setPermissions(prev => ({ ...prev, isLoading: true, error: null }));

        // Check both permissions in parallel
        const [adminResult, housekeepingResult] = await Promise.all([
          isAdminUser(session),
          hasHousekeepingAccess(session)
        ]);

        if (mounted) {
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
  }, [session?.user?.id, session?.user?.email]); // Depend on user ID and email

  return permissions;
} 