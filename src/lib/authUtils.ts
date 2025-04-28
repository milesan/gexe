import { Session } from '@supabase/supabase-js';
// import { logError } from './logging'; // Assuming you have a logging utility

// Centralized list of admin emails - THE SINGLE SOURCE OF TRUTH
const adminEmails = new Set([
  'andre@thegarden.pt',
  'redis213@gmail.com',
  'dawn@thegarden.pt',
  'simone@thegarden.pt',
  'samjlloa@gmail.com',
  'redis213+testadmin@gmail.com' // Including the one previously only in AuthenticatedApp
]);

/**
 * Checks if the provided Supabase session belongs to an admin user.
 * @param session - The Supabase Session object (or null).
 * @returns True if the user is an admin, false otherwise.
 */
export function isAdminUser(session: Session | null): boolean {
  const userEmail = session?.user?.email;

  if (!userEmail) {
    console.log('[isAdminUser] No user email found in session.'); // Optional debug log
    return false;
  }

  const isAdmin = adminEmails.has(userEmail);
  console.log(`[isAdminUser] Checking email: ${userEmail}, Result: ${isAdmin}`); // Optional debug log
  
  // Optional: Log if an admin check fails unexpectedly for debugging later
  // if (!isAdmin && userEmail.includes('@thegarden.pt')) { 
  //    logError('Non-admin check for potential admin email', { email: userEmail });
  // }

  return isAdmin;
}

// Example of adding a basic logging function if you don't have one
// You should replace this with your actual logging setup
// export function logError(message: string, context?: object) {
//   console.error(`ERROR: ${message}`, context || '');
//   // Send to error tracking service (e.g., Sentry) here
// } 