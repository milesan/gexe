import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save } from 'lucide-react';

interface Props {
  show: boolean;
  onClose: () => void;
}

export function AutosaveNotification({ show, onClose }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          onClick={onClose}
          // Removed positioning classes, kept styling and clip-path
          className="bg-retro-accent/10 backdrop-blur-sm text-retro-accent px-4 py-2 rounded cursor-pointer pointer-events-auto" // Added pointer-events-auto back
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
          <div className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            <span className="text-sm">Progress saved</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}