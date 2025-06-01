import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
// import { logError } from './logging'; // Assuming you have a logging utility

// Centralized list of housekeeping access emails
const housekeepingEmails = new Set([
  'solarlovesong@gmail.com',
  'samckclarke@gmail.com'
]);

/**
 * Checks if the provided Supabase session belongs to an admin user.
 * Uses the Supabase is_admin() RPC function as the single source of truth.
 * @param session - The Supabase Session object (or null).
 * @returns Promise<boolean> - True if the user is an admin, false otherwise.
 */
export async function isAdminUser(session: Session | null): Promise<boolean> {
  if (!session?.user?.email) {
    console.log('[isAdminUser] No user email found in session.');
    return false;
  }

  try {
    const { data, error } = await supabase.rpc('is_admin');
    
    if (error) {
      console.error('[isAdminUser] Error calling is_admin RPC:', error);
      return false;
    }

    const isAdmin = data === true;
    console.log(`[isAdminUser] Checking email: ${session.user.email}, Result: ${isAdmin}`);
    
    return isAdmin;
  } catch (err) {
    console.error('[isAdminUser] Exception calling is_admin RPC:', err);
    return false;
  }
}

/**
 * Checks if the provided Supabase session belongs to a user with housekeeping access.
 * Uses the Supabase has_housekeeping_access() RPC function as the single source of truth.
 * @param session - The Supabase Session object (or null).
 * @returns Promise<boolean> - True if the user has housekeeping access, false otherwise.
 */
export async function hasHousekeepingAccess(session: Session | null): Promise<boolean> {
  if (!session?.user?.email) {
    console.log('[hasHousekeepingAccess] No user email found in session.');
    return false;
  }

  try {
    const { data, error } = await supabase.rpc('has_housekeeping_access');
    
    if (error) {
      console.error('[hasHousekeepingAccess] Error calling has_housekeeping_access RPC:', error);
      return false;
    }

    const hasAccess = data === true;
    console.log(`[hasHousekeepingAccess] Checking email: ${session.user.email}, Result: ${hasAccess}`);
    
    return hasAccess;
  } catch (err) {
    console.error('[hasHousekeepingAccess] Exception calling has_housekeeping_access RPC:', err);
    return false;
  }
}

/**
 * TEMPORARY: Synchronous fallback function for housekeeping access.
 * @deprecated Use hasHousekeepingAccess() instead when possible
 */
export function hasHousekeepingAccessSync(session: Session | null): boolean {
  const userEmail = session?.user?.email;
  if (!userEmail) return false;
  
  return housekeepingEmails.has(userEmail);
}

// Example of adding a basic logging function if you don't have one
// You should replace this with your actual logging setup
// export function logError(message: string, context?: object) {
//   console.error(`ERROR: ${message}`, context || '');
//   // Send to error tracking service (e.g., Sentry) here
// } 