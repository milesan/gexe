import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { getFrontendUrl } from '../lib/environment';

interface Props {
  onComplete: () => void;
}

const ASCII_ART = `████████╗██╗  ██╗███████╗     ██████╗  █████╗ ██████╗ ██████╗ ███████╗███╗   ██╗
╚══██╔══╝██║  ██║██╔════╝    ██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗  ██║
   ██║   ███████║█████╗      ██║  ███╗███████║██████╔╝██║  ██║█████╗  ██╔██╗ ██║
   ██║   ██╔══██║██╔══╝      ██║   ██║██╔══██║██╔══██╗██║  ██║██╔══╝  ██║╚██╗██║
   ██║   ██║  ██║███████╗    ╚██████╔╝██║  ██║██║  ██║██████╔╝███████╗██║ ╚████║
   ╚═╝   ╚═╝  ╚═╝╚══════╝     ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝`;

const MOBILE_ASCII_ART = `████████╗██╗  ██╗███████╗
╚══██╔══╝██║  ██║██╔════╝
   ██║   ███████║█████╗  
   ██║   ██╔══██║██╔══╝  
   ██║   ██║  ██║███████╗
   ╚═╝   ╚═╝  ╚═╝╚══════╝

██████╗  █████╗ ██████╗ ██████╗ ███████╗███╗   ██╗
██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗  ██║
██║  ███╗███████║██████╔╝██║  ██║█████╗  ██╔██╗ ██║
██║   ██║██╔══██║██╔══██╗██║  ██║██╔══╝  ██║╚██╗██║
╚██████╔╝██║  ██║██║  ██║██████╔╝███████╗██║ ╚████║
 ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝`;

export function AnimatedTerminal({ onComplete }: Props) {
  const [asciiLines, setAsciiLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [showBorder, setShowBorder] = useState(false);
  const [isAsciiLoaded, setIsAsciiLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [useMatrixTheme] = useState(() => Math.random() < 0.33);
  const navigate = useNavigate();
  const isMobile = window.innerWidth < 768;
  const [serverDown, setServerDown] = useState(false);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    setAsciiLines((isMobile ? MOBILE_ASCII_ART : ASCII_ART).split('\n'));
    setIsAsciiLoaded(true);
  }, [isMobile]);

  useEffect(() => {
    // Simple timer to show border after a delay
    const timer = setTimeout(() => {
      setShowBorder(true);
      setTimeout(() => setShowLogin(true), 1000);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (asciiLines.length === 0 || currentLine >= asciiLines.length) return;

    const line = asciiLines[currentLine];
    if (currentChar >= line.length) {
      setTimeout(() => {
        setCurrentLine(prev => prev + 1);
        setCurrentChar(0);
      }, 100);
      return;
    }

    const timer = setTimeout(() => {
      setCurrentChar(prev => prev + 1);
    }, 7);

    return () => clearTimeout(timer);
  }, [asciiLines, currentLine, currentChar]);

  useEffect(() => {
    if (currentLine >= asciiLines.length && asciiLines.length > 0 && isAsciiLoaded) {
      console.log('[AnimatedTerminal] ASCII art animation complete');
      setTimeout(onComplete, 500);
    }
  }, [currentLine, asciiLines.length, onComplete, isAsciiLoaded]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    setOtpSent(false);

    // Normalize email to lowercase to match Supabase Auth behavior
    const normalizedEmail = email.toLowerCase().trim();

    try {
      console.log('[AnimatedTerminal] Requesting code for:', normalizedEmail);
      
      // STEP 1: Check if this email is whitelisted and create auth user if needed
      console.log('[AnimatedTerminal] Checking whitelist status...');
      const { data: whitelistResult, error: whitelistError } = await supabase.functions.invoke('create-whitelisted-auth-user', {
        body: { email: normalizedEmail }
      });

      if (whitelistError) {
        // This is now only for unexpected errors (e.g., function down, network issues).
        console.warn('[AnimatedTerminal] Whitelist check failed unexpectedly, continuing with normal signup flow:', whitelistError);
      } else if (whitelistResult) {
        // We got a 200 response, now check the payload.
        if (whitelistResult.isWhitelisted && whitelistResult.success) {
          console.log(`[AnimatedTerminal] Whitelisted user auth account ${whitelistResult.operation}: ${whitelistResult.userId}`);
        } else {
          // This covers the isWhitelisted: false case, which is an expected flow.
          console.log('[AnimatedTerminal] Email not whitelisted, proceeding with normal signup flow.');
        }
      }

      // STEP 2: Send magic link (works for both whitelisted and normal users now)
      const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail });
      if (error) throw error;
      setSuccess('Code sent! Check your email (and spam/junk folder).');
      setOtpSent(true);
      console.log('[AnimatedTerminal] OTP request successful for:', normalizedEmail);
    } catch (err) {
      console.error('[AnimatedTerminal] Error requesting code:', err);
      
      // Check if this looks like a server/database error
      const errorMessage = err instanceof Error ? err.message : 'Failed to send code';
      if (errorMessage.includes('Database error') || errorMessage.includes('AuthApiError')) {
        console.log('[AnimatedTerminal] Detected server issues, switching to fallback mode');
        setServerDown(true);
      } else {
        setError(errorMessage);
      }
      setOtpSent(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    // Normalize email to lowercase to match Supabase Auth behavior
    const normalizedEmail = email.toLowerCase().trim();

    try {
      console.log(`[AnimatedTerminal] Verifying code for: ${normalizedEmail} with token: ${otp}`);
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: otp,
        type: 'email',
      });

      if (error) throw error;
      
      if (data.session) {
        console.log('[AnimatedTerminal] OTP verification successful, session:', data.session);
        setSuccess('Login successful!');
        onComplete();
      } else {
        console.warn('[AnimatedTerminal] OTP verified but no session returned.');
        throw new Error('Verification succeeded but failed to establish session.');
      }

    } catch (err) {
      console.error('[AnimatedTerminal] Error verifying code:', err);
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div 
      className="h-[100dvh] bg-cover bg-center bg-no-repeat flex items-center justify-center"
      style={{
        backgroundImage: `url('https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/background-image//login-background.png')`
      }}
    >
      <div className="w-full h-full max-w-[1000px] relative flex items-center justify-center px-4" ref={containerRef}>
        {/* Hidden admin click area */}
        <div
          onClick={() => navigate('/retro2')}
          className="absolute top-0 right-0 w-[30px] h-[30px] cursor-default z-50"
          style={{ opacity: 0 }}
        />

        {/* Fluorescent border with glow */}
        <motion.div
          className="absolute inset-8 sm:inset-12 md:inset-16 lg:inset-20 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={showBorder ? { opacity: 1 } : {}}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          {/* Fluorescent border */}
          <div 
            className="absolute inset-0 border-2 border-retro-accent/80 rounded-sm"
            style={{
              boxShadow: '0 0 8px rgba(0, 255, 0, 0.3), inset 0 0 8px rgba(0, 255, 0, 0.1)',
            }}
          />
          
          {/* Pulsing glow effect */}
          <motion.div 
            className="absolute inset-0 rounded-sm"
            animate={showBorder ? {
              boxShadow: [
                '0 0 10px rgba(0, 255, 0, 0.15)',
                '0 0 15px rgba(0, 255, 0, 0.2)',
                '0 0 10px rgba(0, 255, 0, 0.15)',
              ]
            } : {}}
            transition={{
              duration: 4,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "loop"
            }}
          />
        </motion.div>

        <AnimatePresence>
          {showLogin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {/* Use padding instead of calculated width for better responsiveness */}
              <div className="w-full max-w-[300px] px-6 sm:px-0">
                <div className="p-4 sm:p-8">
                  {serverDown ? (
                    // Server down fallback UI
                    <>
                      <div className="flex items-center justify-center gap-3 mb-8">
                        <h1 className="text-lg font-display text-retro-accent whitespace-nowrap">
                          Server's Down
                        </h1>
                      </div>
                      
                      <div className="mb-6 text-center">
                        <p className="font-mono text-retro-accent/80 text-sm mb-4">
                          We're having technical difficulties.
                        </p>
                        <p className="font-mono text-retro-accent/60 text-xs mb-3">
                          Come back later.
                        </p>
                        <p className="font-mono text-retro-accent/60 text-xs">
                          Message{' '}
                          <a 
                            href="mailto:living@thegarden.pt" 
                            className="text-retro-accent hover:text-accent-secondary underline"
                          >
                            living@thegarden.pt
                          </a>
                          {' '}for the time being.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setServerDown(false);
                          setError(null);
                        }}
                        className="w-full font-mono text-retro-accent/60 text-sm hover:text-retro-accent underline"
                      >
                        ← try login again
                      </button>
                    </>
                  ) : (
                    // Original login UI
                    <>
                      <div className="flex items-center justify-center gap-3 mb-8">
                        <h1 className="text-lg font-display text-retro-accent whitespace-nowrap">
                          Enter The Garden
                        </h1>
                      </div>

                      <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
                        <div className="w-full">
                          <div className={`relative w-full ${ (error || success) ? 'mb-3' : '' }`}>
                            <input
                              type="email"
                              id="email-input"
                              name="email"
                              list="email-list"
                              value={email}
                              onChange={(e) => setEmail(e.target.value.trim())}
                              className="w-full min-w-[200px] bg-black text-retro-accent border-2 border-retro-accent/70 p-3 font-mono focus:outline-none focus:ring-2 focus:ring-retro-accent/50 placeholder-retro-accent/30"
                              style={{
                                clipPath: `polygon(
                                  0 4px, 4px 4px, 4px 0,
                                  calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                                  100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                                  calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                                  0 calc(100% - 4px)
                                )`
                              }}
                              placeholder="email"
                              required
                              autoComplete="email"
                              spellCheck="false"
                              disabled={otpSent || isLoading}
                            />
                          </div>
                        </div>

                        {otpSent && (
                          <div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              id="otp-input"
                              name="otp"
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.trim())}
                              placeholder="Enter code"
                              required
                              disabled={isLoading}
                              className="w-full min-w-[200px] bg-black text-retro-accent border-2 border-retro-accent/70 p-3 font-mono focus:outline-none focus:ring-2 focus:ring-retro-accent/50 placeholder-retro-accent/30 mt-2"
                              style={{
                                clipPath: `polygon(
                                  0 4px, 4px 4px, 4px 0,
                                  calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                                  100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                                  calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                                  0 calc(100% - 4px)
                                )`
                              }}
                            />
                          </div>
                        )}

                        {error && (
                          <div className="font-mono text-red-500 text-sm">
                            {error}
                          </div>
                        )}

                        {success && (
                          <div className="font-mono text-retro-accent text-sm w-full whitespace-pre-wrap">
                            {success}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full bg-retro-accent text-black p-3 font-mono hover:bg-accent-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            clipPath: `polygon(
                              0 4px, 4px 4px, 4px 0,
                              calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                              100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                              calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                              0 calc(100% - 4px)
                            )`
                          }}
                        >
                          {isLoading ? (otpSent ? 'verifying...' : 'sending...') : (otpSent ? 'verify code' : 'send code')}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

