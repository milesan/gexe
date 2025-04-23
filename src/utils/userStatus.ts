import { supabase } from '../lib/supabase';
import { UserStatus, UserStatusInfo } from '../types/user';
import { Session } from '@supabase/supabase-js';

/**
 * Fetches the current user's status information from the database
 * @returns The user status information or null if no user is logged in
 */
export async function getUserStatus(session?: Session | null): Promise<UserStatusInfo | null> {
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from('user_status')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  if (error) {
    console.error('Error fetching user status:', error);
    return null;
  }

  return data as UserStatusInfo;
}

/**
 * Returns whether a user can access app features
 */
export function canAccessApp(userStatus?: UserStatus | null): boolean {
  if (!userStatus) return false;
  
  // Only these statuses can access the main app
  const appAccessStatuses = [
    UserStatus.APPLICATION_APPROVED,
    UserStatus.WHITELISTED,
    UserStatus.ADMIN
  ];
  
  return appAccessStatuses.includes(userStatus);
}

/**
 * Updates the user's status in the database
 * @param userId The user's ID
 * @param status The new status value
 * @param additionalFields Any additional fields to update
 * @returns True if the update was successful
 */
export async function updateUserStatus(
  userId: string,
  status: UserStatus,
  additionalFields?: Partial<Omit<UserStatusInfo, 'user_id' | 'status'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('user_status')
    .upsert({
      user_id: userId,
      status,
      ...additionalFields
    });

  if (error) {
    console.error('Error updating user status:', error);
    return false;
  }

  return true;
} 

/**
 * Checks if a user has seen the welcome screen
 * @param userId The user's ID
 * @returns Promise resolving to whether the user has seen the welcome screen
 */
export async function hasSeenWelcomeScreen(userId: string): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabase
    .from('user_status')
    .select('welcome_screen_seen')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Error checking welcome screen status:', error);
    return false;
  }

  return data.welcome_screen_seen === true;
}

/**
 * Checks if a user has completed the whitelist signup flow
 * @param userId The user's ID
 * @returns Promise resolving to whether the user has completed whitelist signup
 */
export async function hasCompletedWhitelistSignup(userId: string): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabase
    .from('user_status')
    .select('whitelist_signup_completed')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Error checking whitelist signup status:', error);
    return false;
  }

  return data.whitelist_signup_completed === true;
}

/**
 * Checks if a user is whitelisted (has WHITELISTED or ADMIN status)
 * @param userId The user's ID
 * @returns Promise resolving to whether the user is whitelisted
 */
export async function isWhitelisted(userId: string): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabase
    .from('user_status')
    .select('status')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Error checking whitelist status:', error);
    return false;
  }

  return data.status === UserStatus.WHITELISTED || data.status === UserStatus.ADMIN;
}

/**
 * Checks if a user is an admin
 * @param userId The user's ID
 * @returns Promise resolving to whether the user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabase
    .from('user_status')
    .select('status')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Error checking admin status:', error);
    return false;
  }

  return data.status === UserStatus.ADMIN;
}

/**
 * Checks if a user is a super admin
 * @param userId The user's ID
 * @returns Promise resolving to whether the user is a super admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabase
    .from('user_status')
    .select('is_super_admin')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Error checking super admin status:', error);
    return false;
  }

  return data.is_super_admin === true;
}

/**
 * Gets the current status of a user
 * @param userId The user's ID
 * @returns Promise resolving to the user's status or null if not found
 */
export async function getUserStatusById(userId: string): Promise<UserStatus | null> {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_status')
    .select('status')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Error fetching user status:', error);
    return null;
  }

  return data.status as UserStatus;
} 

