import { useEffect, useState } from 'react';
import { UserStatus, UserStatusInfo } from '../types/user';
import { useSession } from './useSession';
import { getUserStatus, updateUserStatus } from '../utils/userStatus';

/**
 * Hook for accessing and updating the user's status
 * @returns Object containing user status and update functions
 */
export function useUserStatus() {
  const session = useSession();
  const [status, setStatus] = useState<UserStatusInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch the user's status on mount or when session changes
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!session?.user) {
          setStatus(null);
          return;
        }
        
        const userStatus = await getUserStatus(session);
        setStatus(userStatus);
      } catch (err) {
        console.error('Error in useUserStatus hook:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [session]);

  // Update user status in the database and local state
  const updateStatus = async (
    newStatus: UserStatus,
    additionalFields?: Partial<Omit<UserStatusInfo, 'user_id' | 'status'>>
  ) => {
    if (!session?.user?.id) {
      console.error('Cannot update status: No user logged in');
      return false;
    }

    setLoading(true);
    
    try {
      const success = await updateUserStatus(
        session.user.id,
        newStatus,
        additionalFields
      );
      
      if (success && status) {
        // Update local state with new values
        setStatus({
          ...status,
          status: newStatus,
          ...additionalFields,
          // The updated_at field will be updated by the database trigger,
          // but we can approximate it for the UI
          updated_at: new Date().toISOString()
        });
      }
      
      return success;
    } catch (err) {
      console.error('Error updating user status:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Mark the welcome screen as seen
  const markWelcomeScreenSeen = async () => {
    return updateStatus(status?.status || UserStatus.NO_USER, {
      welcome_screen_seen: true
    });
  };

  // Mark whitelist signup as completed
  const markWhitelistSignupCompleted = async () => {
    return updateStatus(status?.status || UserStatus.NO_USER, {
      whitelist_signup_completed: true
    });
  };

  return {
    status: status?.status,
    userStatus: status,
    isAdmin: status?.status === UserStatus.ADMIN,
    isSuperAdmin: status?.is_super_admin === true,
    hasAdminPrivileges: status?.status === UserStatus.ADMIN || status?.is_super_admin === true,
    isWhitelisted: status?.status === UserStatus.WHITELISTED || status?.status === UserStatus.ADMIN,
    welcomeScreenSeen: status?.welcome_screen_seen === true,
    whitelistSignupCompleted: status?.whitelist_signup_completed === true,
    loading,
    error,
    updateStatus,
    markWelcomeScreenSeen,
    markWhitelistSignupCompleted
  };
} 