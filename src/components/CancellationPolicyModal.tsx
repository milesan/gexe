import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface CancellationPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CancellationPolicyModal({ isOpen, onClose }: CancellationPolicyModalProps) {
  return (
    <>
      {isOpen && createPortal(
        <AnimatePresence>
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
              className="bg-[var(--color-bg-surface)] rounded-sm p-4 sm:p-6 max-w-2xl w-full relative z-[101] max-h-[90vh] overflow-y-auto shadow-xl border border-gray-500/30 color-text-primary backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute top-2 sm:top-4 right-2 sm:right-4 color-shade-2 hover:color-text-primary"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl sm:text-2xl font-display font-semibold color-text-primary mb-4 sm:mb-6">
                Cancellation Policy
              </h3>
              
              <div className="space-y-4">
                <p className="text-shade-1 text-sm font-display leading-relaxed">
                  As a non-profit association, your contributions are considered donations that directly support our mission and the operations of this space. While donations are typically non-refundable, we understand that plans can change and offer the following flexibility:
                </p>
                
                <ol className="space-y-3 text-sm text-primary font-display">
                  <li className="flex items-start gap-2">
                    <span className="font-semibold min-w-[1.2rem]">1.</span>
                    <div>
                      <span className="font-semibold">Guests with independent accommodations (van/camping):</span>
                      <br />Always eligible for 85% refund or 100% credit, regardless of timing.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold min-w-[1.2rem]">2.</span>
                    <div>
                      <span className="font-semibold">More than 30 days before arrival:</span>
                      <br />We can offer a 85% refund of your donation or 100% credit for future use within 12 months.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold min-w-[1.2rem]">3.</span>
                    <div>
                      <span className="font-semibold">15 to 30 days before arrival:</span>
                      <br />We can offer a 50%-60% refund of your donation or 75% credit for future use within 12 months.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold min-w-[1.2rem]">4.</span>
                    <div>
                      <span className="font-semibold">Less than 15 days before arrival:</span>
                      <br />Donations are non-refundable at this stage, but we can offer a 50% credit for future use within 12 months.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold min-w-[1.2rem]">5.</span>
                    <div>
                      <span className="font-semibold">Special circumstances (force majeure, injury, or accident):</span>
                      <br />With valid documentation:
                      <ul className="mt-1 ml-4 space-y-1">
                        <li>• More than 15 days before arrival: 85% refund of donation or 100% credit.</li>
                        <li>• 15 days or less before arrival: 75% credit.</li>
                      </ul>
                    </div>
                  </li>
                </ol>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
} 