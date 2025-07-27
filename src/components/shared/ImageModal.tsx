import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageModalProps {
  imageUrl: string;
  onClose: () => void;
}

export function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative max-w-3xl w-full max-h-[85vh]"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={imageUrl}
              alt="Full size view"
              className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-sm"
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
