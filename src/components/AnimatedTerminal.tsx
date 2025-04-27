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
  const [borderChars, setBorderChars] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [useMatrixTheme] = useState(() => Math.random() < 0.33);
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
    setAsciiLines((isMobile ? MOBILE_ASCII_ART : ASCII_ART).split('\n'));
  }, [isMobile]);

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
    if (currentLine >= asciiLines.length && asciiLines.length > 0) {
      setTimeout(onComplete, 500);
    }
  }, [currentLine, asciiLines.length, onComplete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
  
    const redirectUrl = `${getFrontendUrl()}/auth/callback`;
  
    try {
      console.log('[AnimatedTerminal] Sending magic link to:', email, 'Redirecting to:', redirectUrl);
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
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full h-[95vh] max-w-[1000px] relative flex items-center justify-center px-4" ref={containerRef}>
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
            className="absolute font-mono text-retro-accent text-xl"
            style={{
              ...getBorderPosition(index, dimensions),
              transform: getBorderTransform(index, dimensions)
            }}
          >
            {char}
          </motion.div>
        ))}

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
                <div className="bg-black p-4 sm:p-8">
                  <div className="flex items-center justify-center gap-3 mb-8">
                    <h1 className="text-lg font-display text-retro-accent whitespace-nowrap">
                      enter the garden
                    </h1>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="w-full">
                      <div className={`relative w-full ${ (error || success) ? 'mb-3' : '' }`}>
                        <input
                          type="email"
                          id="email-input"
                          name="email"
                          list="email-list"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
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
                        />
                      </div>
                    </div>

                    {/* Remove the wrapper div */}
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
                      {isLoading ? 'sending...' : 'send magic link'}
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

function getBorderPosition(index: number, dims = { width: 0, height: 0 }) {
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
}

function getBorderTransform(index: number, dims = { width: 0, height: 0 }): string {
  const { width: totalWidth, height: totalHeight } = dims;
  const totalChars = (totalWidth * 2) + (totalHeight * 2);

  const isTopEdge = index < totalWidth;
  const isRightEdge = index >= totalWidth && index < totalWidth + totalHeight;
  const isBottomEdge = index >= totalWidth + totalHeight && index < totalWidth * 2 + totalHeight;
  const isLeftEdge = index >= totalWidth * 2 + totalHeight;

  const isTopLeft = index === 0;
  const isTopRight = index === totalWidth - 1;
  const isBottomRight = index === totalWidth + totalHeight -1;
  const isBottomLeft = index === totalWidth * 2 + totalHeight -1;

  if (isTopLeft) return 'translate(0, 0)';
  if (isTopRight) return 'translate(-100%, 0)';
  if (isBottomRight) return 'translate(-100%, -100%)';
  if (isBottomLeft) return 'translate(0, -100%)';

  if (isTopEdge) return 'translate(-50%, 0)';
  if (isRightEdge) return 'translate(-100%, -50%)';
  if (isBottomEdge) return 'translate(-50%, -100%)';
  if (isLeftEdge) return 'translate(0, -50%)';

  return 'translate(-50%, -50%)';
}