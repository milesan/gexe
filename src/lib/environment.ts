/**
 * Determines the frontend URL based on the current environment
 * Follows the same logic as used in AnimatedTerminal
 */
export function getFrontendUrl(): string {
  const isNetlify = !!process.env.NETLIFY;
  
  if (isNetlify) {
    // Netlify environment: Use DEPLOY_URL for previews, APP_URL for production
    return process.env.DEPLOY_URL || 
           process.env.APP_URL || 
           window.location.origin;
  }
  
  // Local development: Use VITE_APP_URL or fallback to window.location.origin
  return import.meta.env.VITE_APP_URL || window.location.origin;
} 