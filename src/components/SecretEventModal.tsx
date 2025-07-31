import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isRangeSelection?: boolean;
}

export function SecretEventModal({ isOpen, onClose, isRangeSelection = false }: Props) {
  // Add debug logging
  console.log('[SecretEventModal] Render state:', { isOpen, isRangeSelection });
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[var(--color-bg-surface)] rounded-sm p-4 sm:p-6 max-w-md w-full relative z-[101] max-h-[90vh] overflow-y-auto shadow-xl border border-gray-500/30 color-text-primary backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-2 sm:top-4 right-2 sm:right-4 color-shade-2 hover:color-text-primary"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-display color-text-primary">
                {isRangeSelection ? 'Selection Includes Blocked Week' : 'Garden Rental Week'}
              </h3>
            </div>

            {isRangeSelection ? (
              <>
                <p className="color-shade-2 mb-6 font-mono">
                  Your selection includes the week of September 23-29th, 2025, which is closed for a secret off-site event.
                </p>
                
                <p className="color-shade-2 mb-6 font-mono">
                  Please adjust your selection to avoid the blocked week, or if you're interested in renting the venue over that week (or for next season), please send a direct enquiry to{' '}
                  <a 
                    href="mailto:dawn@thegarden.pt?subject=Garden Rental Inquiry&body=Hi, I am interested in renting the garden for all or part of Sep 23-29th"
                    className="text-accent-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    dawn@thegarden.pt
                  </a>
                </p>
              </>
            ) : (
              <>
                <p className="color-shade-2 mb-6 font-mono">
                  The Garden is closed for a secret off-site event.
                </p>
                
                <p className="color-shade-2 mb-6 font-mono">
                  If you're interested in renting the venue over that week (or for next season), please send a direct enquiry to{' '}
                  <a 
                    href="mailto:dawn@thegarden.pt?subject=Garden Rental Inquiry&body=Hi, I am interested in renting the garden for all or part of Sep 23-29th"
                    className="text-accent-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    dawn@thegarden.pt
                  </a>
                </p>
              </>
            )}
            
            <button
              onClick={onClose}
              className="w-full bg-accent-primary text-black py-2 rounded-sm transition-colors hover:brightness-90 font-mono"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 