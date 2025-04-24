import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { getFrontendUrl } from '../lib/environment';


export function Auth() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => { // Dead code ? Duplicate in AnimatedTerminal.tsx 
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
  
    // Determine the base URL based on environment
    const redirectUrl = `${getFrontendUrl()}/auth/callback`;
    console.log('Redirecting to:', redirectUrl);
    try {
      console.log('[Auth] Sending magic link to:', email, 'Redirecting to:', redirectUrl);
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
      setSuccess('Check your email for the magic link. If you don\'t see it, check your spam/junk folder.');
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
            <h1 className="text-xl sm:text-2xl font-lettra-bold text-primary">The Garden</h1>
          </div>
        </div>
        <p className="text-secondary font-body">Welcome to reality</p>
      </div>
      
      <div className="bg-surface p-8 rounded-xl shadow-sm border border-color">
        {error && (
          <div className="mb-6 p-4 bg-error-muted border border-error-muted text-error rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-accent-muted border border-accent-muted text-accent-primary rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-primary mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-color rounded-md shadow-sm focus:ring-accent-primary focus:border-accent-primary bg-main text-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent-primary text-white py-2 px-4 rounded-md hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>
      </div>
    </div>
  );
}