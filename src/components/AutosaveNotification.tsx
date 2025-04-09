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

  // REVERTING calc() approach, REAPPLYING nested structure for proper centering

  return (
    <AnimatePresence>
      {isVisible && (
        // Outer full-width fixed container (non-interactive)
        <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-50">
          {/* Inner container matching form's max-width and centering */}
          <div className="relative max-w-2xl mx-auto">
            {/* Actual notification, positioned absolutely within the inner container */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onClick={onClose}
              // Position absolutely bottom-center relative to the max-w-2xl container, enable pointer events
              className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto bg-[#FFBF00]/10 backdrop-blur-sm text-[#FFBF00] px-4 py-2 rounded cursor-pointer"
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
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}