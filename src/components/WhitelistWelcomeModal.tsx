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
          className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--color-bg-surface)] border-2 border-[var(--color-garden-matrix)]/70 max-w-md w-full p-8 text-center"
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
            <div
              className="w-12 h-12 mx-auto mb-4"
              style={{
                backgroundColor: 'var(--color-garden-matrix)',
                maskImage: 'url(https://raw.githubusercontent.com/milesan/synesthesia/refs/heads/main/Enso%20Zen%20Soto%20Symbol.png)',
                WebkitMaskImage: 'url(https://raw.githubusercontent.com/milesan/synesthesia/refs/heads/main/Enso%20Zen%20Soto%20Symbol.png)',
                maskSize: 'contain',
                WebkitMaskSize: 'contain',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskPosition: 'center',
                opacity: 0.9 
              }}
            ></div>
            <h2 className="text-[var(--color-garden-matrix)] text-2xl font-display mb-4">Welcome to The Garden</h2>
            <p className="font-mono text-sm text-[var(--color-text-primary)] opacity-75 mb-6">
              You have been approved for 2025 and have bypassed the application.
            </p>
            <button
              onClick={handleClose}
              className="bg-[var(--color-garden-matrix)] text-[var(--color-bg-main)] px-8 py-3 font-display text-xl"
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
