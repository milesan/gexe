import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, Tag, Clock, CreditCard, Home, Utensils, Percent } from 'lucide-react';

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

  // Calculate base totals and discounts
  const baseAccommodation = booking.accommodation_price || 0;
  const baseFoodFacilities = booking.food_contribution || 0;
  const baseSubtotal = baseAccommodation + baseFoodFacilities;
  
  // Seasonal discount (accommodation only)
  const seasonalDiscount = booking.seasonal_adjustment || 0;
  
  // Duration discount percentage
  const durationDiscountPercent = booking.duration_discount_percent || 0;
  
  // Calculate duration discount amounts
  // In the booking flow, users can choose lower F&F contribution due to duration discount
  // But the breakdown shows what they actually chose, not the potential discount
  const accommodationAfterSeasonal = baseAccommodation - seasonalDiscount;
  const durationDiscountOnAccommodation = accommodationAfterSeasonal * (durationDiscountPercent / 100);
  
  // Discount code applies to everything
  const discountCodePercent = booking.discount_code_percent || 0;
  const subtotalAfterSpecificDiscounts = baseSubtotal - seasonalDiscount - durationDiscountOnAccommodation;
  const discountCodeAmount = subtotalAfterSpecificDiscounts * (discountCodePercent / 100);

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
            className="bg-[var(--color-bg-surface)] rounded-lg max-w-lg w-full p-6 shadow-xl border border-gray-500/30 backdrop-blur-sm max-h-[90vh] overflow-y-auto"
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
              <div className="text-sm text-[var(--color-text-secondary)] mb-4">
                {booking.accommodation_title}
              </div>

              {hasBreakdown ? (
                <div className="space-y-4">
                  {/* Base Costs Section */}
                  <div className="bg-[var(--color-bg-shade)] rounded-lg p-4 space-y-3">
                    <h4 className="text-xs uppercase text-[var(--color-text-secondary)] font-semibold mb-2">Base Costs</h4>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-primary)] flex items-center gap-2">
                        <Home className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Accommodation
                      </span>
                      <span className="font-mono text-[var(--color-text-primary)]">
                        €{baseAccommodation.toFixed(2)}
                      </span>
                    </div>

                    {baseFoodFacilities > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--color-text-primary)] flex items-center gap-2">
                          <Utensils className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          Food & Facilities
                        </span>
                        <span className="font-mono text-[var(--color-text-primary)]">
                          €{baseFoodFacilities.toFixed(2)}
                        </span>
                      </div>
                    )}
                    
                    <div className="border-t border-[var(--color-border)] pt-2 mt-2">
                      <div className="flex justify-between items-center font-semibold">
                        <span className="text-[var(--color-text-primary)]">Subtotal</span>
                        <span className="font-mono text-[var(--color-text-primary)]">
                          €{baseSubtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Discounts Section */}
                  {(seasonalDiscount > 0 || durationDiscountPercent > 0 || booking.applied_discount_code) && (
                    <div className="bg-emerald-50/10 rounded-lg p-4 space-y-3 border border-emerald-600/20">
                      <h4 className="text-xs uppercase text-emerald-600 font-semibold mb-2">Discounts Applied</h4>

                      {/* Seasonal Discount */}
                      {seasonalDiscount > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-emerald-600">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-600" />
                              Seasonal discount
                            </span>
                            <span className="font-mono">-€{seasonalDiscount.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-[var(--color-text-secondary)] pl-4">
                            Applied to accommodation only
                          </p>
                        </div>
                      )}

                      {/* Duration Discount */}
                      {durationDiscountPercent > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-emerald-600">
                            <span className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Duration discount ({durationDiscountPercent.toFixed(1)}%)
                            </span>
                            <span className="font-mono">-€{durationDiscountOnAccommodation.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-[var(--color-text-secondary)] pl-4">
                            Applied to accommodation after seasonal discount
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)] pl-4 italic">
                            * User was also given the option to reduce Food & Facilities contribution
                          </p>
                        </div>
                      )}

                      {/* Discount Code */}
                      {booking.applied_discount_code && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-emerald-600">
                            <span className="flex items-center gap-2">
                              <Tag className="w-4 h-4" />
                              Code: {booking.applied_discount_code}
                              {discountCodePercent > 0 && ` (${discountCodePercent}%)`}
                            </span>
                            <span className="font-mono">-€{discountCodeAmount.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-[var(--color-text-secondary)] pl-4">
                            Applied to total after other discounts
                          </p>
                        </div>
                      )}

                      {/* Total Saved */}
                      {booking.discount_amount !== null && booking.discount_amount !== undefined && booking.discount_amount > 0 && (
                        <div className="border-t border-emerald-600/20 pt-2 mt-2">
                          <div className="flex justify-between items-center text-emerald-600 font-semibold">
                            <span>Total Saved</span>
                            <span className="font-mono">-€{booking.discount_amount.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Credits Section */}
                  {booking.credits_used !== null && booking.credits_used !== undefined && booking.credits_used > 0 && (
                    <div className="bg-blue-50/10 rounded-lg p-4 border border-blue-600/20">
                      <div className="flex justify-between items-center text-blue-600">
                        <span className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Credits Used
                        </span>
                        <span className="font-mono">-€{booking.credits_used.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                        Applied to final total
                      </p>
                    </div>
                  )}

                  {/* Final Total */}
                  <div className="bg-[var(--color-bg-shade)] rounded-lg p-4">
                    <div className="flex justify-between items-center font-semibold text-lg">
                      <span className="text-[var(--color-text-primary)]">Total Paid</span>
                      <span className="font-mono text-[var(--color-text-primary)]">
                        €{booking.total_price.toFixed(2)}
                      </span>
                    </div>
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