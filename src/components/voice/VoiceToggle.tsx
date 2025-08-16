import React from 'react';
import { Mic, Keyboard, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface VoiceToggleProps {
  isVoiceMode: boolean;
  onToggle: (voiceMode: boolean) => void;
  disabled?: boolean;
}

export function VoiceToggle({ isVoiceMode, onToggle, disabled = false }: VoiceToggleProps) {
  return (
    <div className="relative">
      {/* Floating toggle button with pulse effect */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-8 right-8 z-50"
      >
        <div className="relative">
          {/* Pulse effect when in voice mode */}
          {isVoiceMode && (
            <>
              <div className="absolute inset-0 rounded-full bg-retro-accent/30 animate-ping" />
              <div className="absolute inset-0 rounded-full bg-retro-accent/20 animate-ping animation-delay-500" />
            </>
          )}
          
          <button
            onClick={() => onToggle(!isVoiceMode)}
            disabled={disabled}
            className={`
              relative group flex items-center gap-3 px-6 py-4 rounded-full
              transition-all duration-300 shadow-lg backdrop-blur-sm
              ${isVoiceMode 
                ? 'bg-retro-accent text-black hover:bg-retro-accent-bright' 
                : 'bg-black/90 text-retro-accent border-2 border-retro-accent hover:bg-retro-accent hover:text-black'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
            `}
          >
            {/* Icon */}
            <div className="flex items-center gap-2">
              {isVoiceMode ? (
                <>
                  <Mic className="w-5 h-5" />
                  <span className="font-mono font-bold text-sm">Voice Mode</span>
                </>
              ) : (
                <>
                  <Keyboard className="w-5 h-5" />
                  <span className="font-mono font-bold text-sm">Text Mode</span>
                </>
              )}
            </div>

            {/* Sparkle effect */}
            <Sparkles className={`w-4 h-4 ${isVoiceMode ? 'animate-pulse' : ''}`} />
          </button>

          {/* Tooltip/Help text */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 }}
            className="absolute bottom-full mb-3 right-0 w-64 pointer-events-none"
          >
            <div className="bg-black/95 text-retro-accent text-xs font-mono p-3 rounded-lg border border-retro-accent/30">
              {isVoiceMode ? (
                <>
                  <p className="font-bold mb-1">Voice Mode Active</p>
                  <p>Speak your answers naturally. Click to switch to text input.</p>
                </>
              ) : (
                <>
                  <p className="font-bold mb-1">Text Mode Active</p>
                  <p>Type your answers. Click to switch to voice input.</p>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Alternative inline toggle for embedding in forms */}
      <div className="inline-block">
        <button
          onClick={() => onToggle(!isVoiceMode)}
          disabled={disabled}
          className="group relative overflow-hidden rounded-lg transition-all duration-300"
        >
          <div className="relative z-10 flex items-center gap-3 px-4 py-2 bg-black border border-retro-accent/50 hover:border-retro-accent">
            <span className="text-retro-accent-dim text-sm font-mono">
              Does this freak you out?
            </span>
            <span className="text-retro-accent text-sm font-mono font-bold group-hover:text-retro-accent-bright transition-colors">
              Click here to switch to {isVoiceMode ? 'text' : 'voice'}
            </span>
          </div>
          
          {/* Animated background */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-retro-accent/10 to-retro-accent/5"
            initial={{ x: '-100%' }}
            whileHover={{ x: 0 }}
            transition={{ duration: 0.3 }}
          />
        </button>
      </div>

      <style jsx>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        .animation-delay-500 {
          animation-delay: 500ms;
        }
      `}</style>
    </div>
  );
}