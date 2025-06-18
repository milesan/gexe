import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, Tag, Clock, CreditCard } from 'lucide-react';

interface PriceBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    accommodation_title: string;
    total_price: number;
    accommodation_price?: number | null;
    food_contribution?: number | null;
    seasonal_adjustment?: number | null;
    duration_discount_percent?: number | null;
    discount_amount?: number | null;
    applied_discount_code?: string | null;
    credits_used?: number | null;
    discount_code_percent?: number | null;
  };
}

export function PriceBreakdownModal({ isOpen, onClose, booking }: PriceBreakdownModalProps) {
  if (!isOpen) return null;

  const hasBreakdown = booking.accommodation_price !== null && booking.accommodation_price !== undefined;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-[var(--color-bg-surface)] rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-display text-[var(--color-text-primary)] flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Price Breakdown
              </h3>
              <button
                onClick={onClose}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-[var(--color-text-secondary)]">
                {booking.accommodation_title}
              </div>

              {hasBreakdown ? (
                <div className="space-y-3">
                  {/* Accommodation Cost */}
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-text-primary)]">Accommodation</span>
                    <span className="font-mono text-[var(--color-text-primary)]">
                      €{booking.accommodation_price?.toFixed(2)}
                    </span>
                  </div>

                  {/* Food & Facilities */}
                  {booking.food_contribution !== null && booking.food_contribution !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-primary)]">Food & Facilities</span>
                      <span className="font-mono text-[var(--color-text-primary)]">
                        €{booking.food_contribution.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Discounts Section */}
                  {(booking.duration_discount_percent || booking.applied_discount_code || booking.discount_amount) && (
                    <>
                      <hr className="border-[var(--color-border)]" />
                      <div className="space-y-2">
                        <div className="text-xs uppercase text-[var(--color-text-secondary)] font-semibold">
                          Discounts Applied
                        </div>

                        {/* Seasonal Discount */}
                        {booking.seasonal_adjustment !== null && 
                         booking.seasonal_adjustment !== undefined && 
                         booking.seasonal_adjustment > 0 && (
                          <div className="flex justify-between items-center text-emerald-600">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-600" />
                              Seasonal discount
                            </span>
                            <span className="font-mono">-€{booking.seasonal_adjustment.toFixed(2)}</span>
                          </div>
                        )}

                        {/* Duration Discount */}
                        {booking.duration_discount_percent !== null && 
                         booking.duration_discount_percent !== undefined && 
                         booking.duration_discount_percent > 0 && (
                          <div className="flex justify-between items-center text-emerald-600">
                            <span className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Duration discount
                            </span>
                            <span className="font-mono">-{booking.duration_discount_percent.toFixed(1)}%</span>
                          </div>
                        )}

                        {/* Discount Code */}
                        {booking.applied_discount_code && (
                          <div className="flex justify-between items-center text-emerald-600">
                            <span className="flex items-center gap-2">
                              <Tag className="w-4 h-4" />
                              Code: {booking.applied_discount_code}
                            </span>
                            <span className="font-mono">
                              {booking.discount_code_percent ? `-${booking.discount_code_percent}%` : 'Applied'}
                            </span>
                          </div>
                        )}

                        {/* Total Saved */}
                        {booking.discount_amount !== null && 
                         booking.discount_amount !== undefined && 
                         booking.discount_amount > 0 && (
                          <div className="flex justify-between items-center text-emerald-600 font-semibold pt-2 border-t border-[var(--color-border)]">
                            <span>Total Saved</span>
                            <span className="font-mono">-€{booking.discount_amount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Credits Used */}
                  {booking.credits_used !== null && 
                   booking.credits_used !== undefined && 
                   booking.credits_used > 0 && (
                    <>
                      <hr className="border-[var(--color-border)]" />
                      <div className="flex justify-between items-center text-blue-600">
                        <span className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Credits Used
                        </span>
                        <span className="font-mono">-€{booking.credits_used.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {/* Final Total */}
                  <hr className="border-[var(--color-border)]" />
                  <div className="flex justify-between items-center font-semibold text-lg">
                    <span className="text-[var(--color-text-primary)]">Total Paid</span>
                    <span className="font-mono text-[var(--color-text-primary)]">
                      €{booking.total_price.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--color-text-secondary)]">
                  <p>Detailed breakdown not available for this booking.</p>
                  <p className="text-sm mt-2">This feature is only available for bookings made after the latest update.</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 