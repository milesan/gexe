import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Auth() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
  
    // Determine the base URL based on environment
    const isNetlify = !!process.env.NETLIFY; // True if running on Netlify
    const baseUrl = isNetlify
      ? (process.env.DEPLOY_URL || process.env.APP_URL || window.location.origin) // Netlify preview or production
      : (import.meta.env.VITE_APP_URL || window.location.origin); // Local dev fallback
  
    const redirectUrl = `${baseUrl}/auth/callback`;
    console.log('Redirecting to:', redirectUrl);
    try {
      console.log('Sending magic link to:', email, 'Redirecting to:', redirectUrl);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            has_applied: false,
          },
        },
      });
      if (error) throw error;
      setSuccess('Check your email for the magic link');
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img 
            src="https://raw.githubusercontent.com/milesan/synesthesia/refs/heads/main/Enso%20Zen%20Soto%20Symbol.png" 
            alt="Logo" 
            className="w-10 h-10"
          />
          <div>
            <h1 className="text-3xl font-display font-light text-stone-900">The Garden</h1>
          </div>
        </div>
        <p className="text-stone-600 font-body">Welcome to reality</p>
      </div>
      
      <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-200">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-900 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-800 text-white py-2 px-4 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>
      </div>
    </div>
  );
}