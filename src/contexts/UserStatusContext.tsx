import React, { createContext, useContext, ReactNode } from 'react';
import { UserStatus, UserStatusInfo } from '../types/user';
import { useUserStatus } from '../hooks/useUserStatus';

interface UserStatusContextValue {
  status: UserStatus | undefined;
  userStatus: UserStatusInfo | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isWhitelisted: boolean;
  welcomeScreenSeen: boolean;
  whitelistSignupCompleted: boolean;
  loading: boolean;
  error: Error | null;
  updateStatus: (
    newStatus: UserStatus,
    additionalFields?: Partial<Omit<UserStatusInfo, 'user_id' | 'status' | 'updated_at'>>
  ) => Promise<boolean>;
  markWelcomeScreenSeen: () => Promise<boolean>;
  markWhitelistSignupCompleted: () => Promise<boolean>;
}

const UserStatusContext = createContext<UserStatusContextValue | undefined>(undefined);

/**
 * Provider component for user status context
 */
export function UserStatusProvider({ children }: { children: ReactNode }) {
  const userStatusData = useUserStatus();

  return (
    <UserStatusContext.Provider value={userStatusData}>
      {children}
    </UserStatusContext.Provider>
  );
}

/**
 * Hook to use the user status context
 */
export function useUserStatusContext(): UserStatusContextValue {
  const context = useContext(UserStatusContext);

  if (context === undefined) {
    throw new Error('useUserStatusContext must be used within a UserStatusProvider');
  }

  return context;
} 