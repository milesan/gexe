import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AnimatedTerminal() {
  const [borderChars, setBorderChars] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAscii, setShowAscii] = useState(true);
  const navigate = useNavigate();
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.floor(width / 12),
          height: Math.floor(height / 20)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const chars: string[] = [];
    const totalChars = (dimensions.width * 2) + (dimensions.height * 2);
    const animationDuration = 1500;
    const intervalTime = animationDuration / totalChars;

    for (let i = 0; i < dimensions.width; i++) chars.push('═');
    for (let i = 0; i < dimensions.height; i++) chars.push('║');
    for (let i = 0; i < dimensions.width; i++) chars.push('═');
    for (let i = 0; i < dimensions.height; i++) chars.push('║');

    chars[0] = '╔';
    chars[dimensions.width - 1] = '╗';
    chars[dimensions.width + dimensions.height - 1] = '╝';
    chars[dimensions.width * 2 + dimensions.height - 1] = '╚';

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < totalChars) {
        setBorderChars(prev => [...prev, chars[currentIndex]]);
        currentIndex++;
        if (currentIndex === totalChars) {
          setTimeout(() => setShowLogin(true), 500);
        }
      } else {
        clearInterval(interval);
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [dimensions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      // First try to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      // If sign in fails with "Invalid login credentials", try to sign up
      if (signInError && signInError.message.includes('Invalid login credentials')) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              has_applied: false
            }
          }
        });

        if (signUpError) throw signUpError;

        // If sign up successful, create profile
        if (signUpData?.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              { 
                id: signUpData.user.id,
                email: signUpData.user.email,
                credits: 0
              }
            ]);

          if (profileError) throw profileError;
        }
      } else if (signInError) {
        throw signInError;
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getBorderPosition = (index: number, dims = dimensions) => {
    const { width: totalWidth, height: totalHeight } = dims;

    if (index < totalWidth) {
      return {
        left: `${(index / totalWidth) * 100}%`,
        top: '0'
      };
    } else if (index < totalWidth + totalHeight) {
      return {
        right: '0',
        top: `${((index - totalWidth) / totalHeight) * 100}%`
      };
    } else if (index < (totalWidth * 2) + totalHeight) {
      return {
        right: `${((index - (totalWidth + totalHeight)) / totalWidth) * 100}%`,
        bottom: '0'
      };
    } else {
      return {
        left: '0',
        bottom: `${((index - (totalWidth * 2 + totalHeight)) / totalHeight) * 100}%`
      };
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full h-[95vh] max-w-[1000px] relative flex items-center justify-center" ref={containerRef}>
        {/* Hidden admin click area */}
        <div
          onClick={() => navigate('/retro2')}
          className="absolute top-0 right-0 w-[30px] h-[30px] cursor-default z-50"
          style={{ opacity: 0 }}
        />

        {borderChars.map((char, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.05 }}
            className="absolute font-mono text-[#FFBF00] text-xl"
            style={{
              ...getBorderPosition(index),
              transform: 'translate(-50%, -50%)'
            }}
          >
            {char}
          </motion.div>
        ))}

        <AnimatePresence>
          {showLogin && showAscii && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-full max-w-[400px] p-8">
                <div className="bg-black p-8">
                  <div className="flex items-center justify-center gap-3 mb-8">
                    <Terminal className="text-[#FFBF00]" style={{ width: '1.5rem', height: '1.5rem' }} />
                    <h1 className="text-base sm:text-xl font-mono text-[#FFBF00] whitespace-nowrap">
                      create or remember
                    </h1>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="w-full">
                      <div className="relative w-full">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full min-w-[200px] bg-black text-[#FFBF00] border-2 border-[#FFBF00]/30 p-3 font-mono focus:outline-none focus:ring-2 focus:ring-[#FFBF00]/50 placeholder-[#FFBF00]/30"
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
                          autoComplete="off"
                          spellCheck="false"
                        />
                      </div>
                    </div>

                    <div className="w-full">
                      <div className="relative w-full">
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full min-w-[200px] bg-black text-[#FFBF00] border-2 border-[#FFBF00]/30 p-3 font-mono focus:outline-none focus:ring-2 focus:ring-[#FFBF00]/50 placeholder-[#FFBF00]/30"
                          style={{
                            clipPath: `polygon(
                              0 4px, 4px 4px, 4px 0,
                              calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                              100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                              calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                              0 calc(100% - 4px)
                            )`
                          }}
                          placeholder="password"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="font-mono text-red-500 text-sm">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-[#FFBF00] text-black p-3 font-mono hover:bg-[#FFBF00]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                      {isLoading ? 'Processing...' : 'enter'}
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}