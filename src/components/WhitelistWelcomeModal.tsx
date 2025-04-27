import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function WhitelistWelcomeModal({ isOpen, onClose }: Props) {
  console.log('WhitelistWelcomeModal: Rendering', { isOpen });

  useEffect(() => {
    console.log('WhitelistWelcomeModal: useEffect triggered', { isOpen });
    if (isOpen) {
      console.log('WhitelistWelcomeModal: Modal is open');
    }
  }, [isOpen]);

  const handleClose = () => {
    console.log('WhitelistWelcomeModal: Closing modal');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-black border-2 border-[rgba(var(--color-retro-accent),_0.3)] max-w-md w-full p-8 text-center"
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
            <img 
              src="https://raw.githubusercontent.com/milesan/synesthesia/refs/heads/main/Enso%20Zen%20Soto%20Symbol.png" 
              alt="Logo" 
              className="w-12 h-12 mx-auto mb-4"
              style={{ 
                filter: 'brightness(0) invert(0.75) sepia(0.6) saturate(400%) hue-rotate(360deg)',
                opacity: 0.9
              }}
            />
            <h2 className="text-[rgb(var(--color-retro-accent))] text-2xl font-display mb-4">Welcome to The Garden</h2>
            <p className="font-mono text-sm text-[rgba(var(--color-retro-accent),_0.6)] mb-6">
              You have been approved for 2025 and have bypassed the application.
            </p>
            <button
              onClick={handleClose}
              className="bg-[rgb(var(--color-retro-accent))] text-black px-8 py-3 font-display text-xl"
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
              Enter
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
