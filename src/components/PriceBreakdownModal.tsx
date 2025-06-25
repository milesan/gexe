import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, Home, Utensils, DollarSign, CreditCard, Percent, ArrowDown } from 'lucide-react';

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

interface BreakdownItem {
  originalAmount: number;
  discountAmount: number;
  creditsAmount: number;
  finalAmount: number;
}

export function PriceBreakdownModal({ isOpen, onClose, booking }: PriceBreakdownModalProps) {
  if (!isOpen) return null;

  // Check if we have breakdown data - only check the core pricing fields
  const hasBreakdown = (
    booking.accommodation_price !== null || 
    booking.food_contribution !== null
  );

  if (!hasBreakdown) {
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
              <div className="text-center py-8 text-[var(--color-text-secondary)]">
                <p>Detailed breakdown not available for this booking.</p>
                <p className="text-sm mt-2">This feature is only available for bookings made after the latest update.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Calculate breakdowns
  const accommodationBase = booking.accommodation_price || 0;
  const foodBase = booking.food_contribution || 0;
  const totalBase = accommodationBase + foodBase;
  
  const creditsUsed = booking.credits_used || 0;
  const totalDiscounts = booking.discount_amount || 0;
  
  // Credits allocation: 50/50 split if both components exist, otherwise all to the existing component
  const creditsPerComponent = accommodationBase === 0 && foodBase > 0 
    ? { accommodation: 0, food: creditsUsed }
    : foodBase === 0 && accommodationBase > 0
    ? { accommodation: creditsUsed, food: 0 }
    : { accommodation: creditsUsed / 2, food: creditsUsed / 2 };
  
  // Calculate accommodation discounts
  const seasonalDiscount = booking.seasonal_adjustment || 0;
  const durationDiscountPercent = booking.duration_discount_percent || 0;
  const discountCodePercent = booking.discount_code_percent || 0;
  
  // Step-by-step accommodation discount calculation
  const accommodationAfterSeasonal = accommodationBase - seasonalDiscount;
  const accommodationDurationDiscount = accommodationAfterSeasonal * (durationDiscountPercent / 100);
  const accommodationAfterDuration = accommodationAfterSeasonal - accommodationDurationDiscount;
  
  // For food, only duration discount applies before discount code
  const foodDurationDiscount = foodBase * (durationDiscountPercent / 100);
  const foodAfterDuration = foodBase - foodDurationDiscount;
  
  // Discount code applies to combined subtotal after other discounts
  const subtotalAfterSpecificDiscounts = accommodationAfterDuration + foodAfterDuration;
  const discountCodeAmount = subtotalAfterSpecificDiscounts * (discountCodePercent / 100);
  
  // Proportionally allocate discount code amount
  const accommodationDiscountCodeAmount = accommodationAfterDuration > 0 
    ? discountCodeAmount * (accommodationAfterDuration / subtotalAfterSpecificDiscounts)
    : 0;
  const foodDiscountCodeAmount = foodAfterDuration > 0
    ? discountCodeAmount * (foodAfterDuration / subtotalAfterSpecificDiscounts) 
    : 0;
  
  // Calculate final amounts for each component
  const accommodationBreakdown: BreakdownItem = {
    originalAmount: accommodationBase,
    discountAmount: seasonalDiscount + accommodationDurationDiscount + accommodationDiscountCodeAmount,
    creditsAmount: creditsPerComponent.accommodation,
    finalAmount: accommodationBase - (seasonalDiscount + accommodationDurationDiscount + accommodationDiscountCodeAmount) - creditsPerComponent.accommodation
  };
  
  const foodBreakdown: BreakdownItem = {
    originalAmount: foodBase,
    discountAmount: foodDurationDiscount + foodDiscountCodeAmount,
    creditsAmount: creditsPerComponent.food,
    finalAmount: foodBase - (foodDurationDiscount + foodDiscountCodeAmount) - creditsPerComponent.food
  };
  
  const totalBreakdown: BreakdownItem = {
    originalAmount: totalBase,
    discountAmount: totalDiscounts,
    creditsAmount: creditsUsed,
    finalAmount: booking.total_price - creditsUsed
  };

  const BreakdownSection = ({ 
    title, 
    icon, 
    breakdown, 
    showIfZero = false 
  }: { 
    title: string; 
    icon: React.ReactNode; 
    breakdown: BreakdownItem;
    showIfZero?: boolean;
  }) => {
    if (!showIfZero && breakdown.originalAmount === 0) return null;
    
    return (
      <div className="bg-[var(--color-bg-shade)] rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
          {icon}
          {title}
        </h4>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-[var(--color-text-secondary)]">Original Amount</span>
            <span className="font-mono text-[var(--color-text-primary)]">€{breakdown.originalAmount.toFixed(2)}</span>
          </div>
          
          {breakdown.discountAmount > 0 && (
            <div className="flex justify-between items-center text-emerald-600">
              <span className="flex items-center gap-1">
                <Percent className="w-3 h-3" />
                Discounts Applied
              </span>
              <span className="font-mono">-€{breakdown.discountAmount.toFixed(2)}</span>
            </div>
          )}
          
          {breakdown.creditsAmount > 0 && (
            <div className="flex justify-between items-center text-blue-600">
              <span className="flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                Credits Used
              </span>
              <span className="font-mono">-€{breakdown.creditsAmount.toFixed(2)}</span>
            </div>
          )}
          
          <div className="border-t border-[var(--color-border)] pt-2">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-[var(--color-text-primary)]">Amount Donated</span>
              <span className="font-mono text-[var(--color-text-primary)]">
                €{Math.max(0, breakdown.finalAmount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

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

              {/* Accommodation Breakdown */}
              <BreakdownSection
                title="Accommodation"
                icon={<Home className="w-4 h-4" />}
                breakdown={accommodationBreakdown}
              />

              {/* Food & Facilities Breakdown */}
              <BreakdownSection
                title="Food & Facilities"
                icon={<Utensils className="w-4 h-4" />}
                breakdown={foodBreakdown}
              />

              {/* Arrow pointing down */}
              <div className="flex justify-center py-2">
                <ArrowDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </div>

              {/* Total Breakdown */}
              <BreakdownSection
                title="Total"
                icon={<DollarSign className="w-4 h-4" />}
                breakdown={totalBreakdown}
                showIfZero={true}
              />

              {/* Applied Discounts Details */}
              {(booking.applied_discount_code || seasonalDiscount > 0 || durationDiscountPercent > 0) && (
                <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Discount Details</h4>
                  <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
                    {seasonalDiscount > 0 && (
                      <p>• Seasonal discount: €{seasonalDiscount.toFixed(2)} (accommodation only)</p>
                    )}
                    {durationDiscountPercent > 0 && (
                      <p>• Duration discount: {durationDiscountPercent.toFixed(1)}% (accommodation + food)</p>
                    )}
                    {booking.applied_discount_code && (
                      <p>• Code "{booking.applied_discount_code}": {discountCodePercent.toFixed(1)}% (applied to subtotal)</p>
                    )}
                    {creditsUsed > 0 && (
                      <p>• Credits allocated: €{creditsPerComponent.accommodation.toFixed(2)} accommodation, €{creditsPerComponent.food.toFixed(2)} food</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 