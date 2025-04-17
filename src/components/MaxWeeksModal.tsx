import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function MaxWeeksModal({ isOpen, onClose }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-bg-surface rounded-lg max-w-md w-full p-4 sm:p-6 border border-border text-text-primary shadow-xl relative max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={onClose}
              className="absolute top-2 sm:top-4 right-2 sm:right-4 text-text-secondary hover:text-text-primary transition-colors z-[1]"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-display">Hold Your Horses!</h3>
            </div>

            <p className="text-text-secondary mb-6 font-mono">
              You may only spend 3 months at the Garden every 6 months. Give the rest of the world a chance ❧
            </p>
            
            <button
              onClick={onClose}
              className="w-full bg-accent-primary text-white py-2 rounded transition-colors hover:brightness-90 font-mono"
            >
              Cool
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
