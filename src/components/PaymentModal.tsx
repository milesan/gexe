import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useStripePayment } from '../hooks/useStripePayment';
import { PaymentDetails } from '../services/stripe/types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentDetails: PaymentDetails;
}

export function PaymentModal({ isOpen, onClose, paymentDetails }: PaymentModalProps) {
  const { handlePayment, loading, error } = useStripePayment({
    onError: (err) => {
      console.error('[Payment Modal] Payment failed:', err);
    },
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-lg bg-white rounded-xl shadow-lg p-6"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display">Confirm Booking</h2>
                <p className="text-stone-600 mt-1">
                  You're about to book {paymentDetails.description}
                </p>
              </div>

              {/* Price breakdown */}
              <div className="bg-stone-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-stone-600">Total Amount</span>
                  <span className="font-display text-xl">
                    €{paymentDetails.amount}
                  </span>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
                  {error.message}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePayment(paymentDetails)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-emerald-900 text-white rounded-lg hover:bg-emerald-800 disabled:bg-emerald-900/50"
                >
                  {loading ? 'Processing...' : 'Proceed to Payment'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
