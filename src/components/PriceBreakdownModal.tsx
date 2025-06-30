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
    seasonal_discount_percent?: number | null; // NEW: Seasonal discount as percentage
    duration_discount_percent?: number | null;
    discount_amount?: number | null;
    applied_discount_code?: string | null;
    credits_used?: number | null;
    discount_code_percent?: number | null;
    discount_code_applies_to?: string | null;
    accommodation_price_paid?: number | null; // NEW: Actual accommodation amount paid
    accommodation_price_after_seasonal_duration?: number | null; // NEW: After seasonal/duration discounts
    subtotal_after_discount_code?: number | null; // NEW: After discount code but before credits
  };
}

interface BreakdownItem {
  originalAmount: number;
  discountAmount: number;
  creditsAmount: number;
  finalAmount: number;
}

// Discount codes with application scope
const knownDiscountCodes: Record<string, { percentage: number; applies_to: 'total' | 'food_facilities' }> = {
  'LUCIEWK2': { percentage: 60, applies_to: 'total' },
  'LEONAISABAMF': { percentage: 60, applies_to: 'food_facilities' },
  'GRETA44': { percentage: 44, applies_to: 'food_facilities' },
  'SPLITBOOK': { percentage: 30, applies_to: 'food_facilities' },
  'ECHONITZSCHE': { percentage: 10, applies_to: 'food_facilities' },
  'BOOKITOUT77': { percentage: 100, applies_to: 'total' },
  'PHILLIPSMUSINGS': { percentage: 38, applies_to: 'total' },
  'LEILALALA': { percentage: 51, applies_to: 'food_facilities' },
  'GRETATERG': { percentage: 50, applies_to: 'total' },
  'ALASKA444': { percentage: 28, applies_to: 'food_facilities' },
  'EUGENIOYO': { percentage: 51, applies_to: 'food_facilities' },
  'ANDREISGAY': { percentage: 99, applies_to: 'total' },
  'FEVERISHMACABRE': { percentage: 100, applies_to: 'food_facilities' },
  'ECHOOFCODY': { percentage: 51, applies_to: 'food_facilities' },
  'HUWRU': { percentage: 41, applies_to: 'food_facilities' },
  'GIBSONSMUSINGS05': { percentage: 50, applies_to: 'total' },
  'SUMMER21': { percentage: 50, applies_to: 'total' },
  'WHYISTHECARDNOTAUTH?': { percentage: 99, applies_to: 'total' },
  'ALICEINGARDENLAND': { percentage: 21, applies_to: 'food_facilities' },
  'META4NETA': { percentage: 9, applies_to: 'food_facilities' },
  'UMEBOSHIILOVEYOU': { percentage: 100, applies_to: 'total' },
  'LLELASBOOKING': { percentage: 100, applies_to: 'total' },
  'GUSTO': { percentage: 30, applies_to: 'total' },
  'RIAIR': { percentage: 25, applies_to: 'food_facilities' },
  'LOVERISES': { percentage: 37, applies_to: 'food_facilities' },
  'MAR-GOT-GOODS': { percentage: 5, applies_to: 'total' },
  'TANAYAYAY': { percentage: 56, applies_to: 'food_facilities' }
};

// Helper to format discount code percent: up to 6 decimals, no trailing zeros
function formatDiscountCodePercent(percent: number) {
  if (percent == null) return '';
  // Show up to 6 decimals, trim trailing zeros and dot
  return percent.toFixed(6).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '').replace(/\.$/, '');
}

// Helper to format discount code amount: up to 2 decimals, no trailing zeros
function formatDiscountCodeAmount(amount: number) {
  if (amount == null) return '';
  return amount.toFixed(2).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '').replace(/\.$/, '');
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


  
  // NEW: Use actual paid amount if available (for new bookings)
  const accommodationPaidActual = booking.accommodation_price_paid;
  
  // Credits allocation: 50/50 split if both components exist, otherwise all to the existing component
  const creditsPerComponent = accommodationBase === 0 && foodBase > 0 
    ? { accommodation: 0, food: creditsUsed }
    : foodBase === 0 && accommodationBase > 0
    ? { accommodation: creditsUsed, food: 0 }
    : { accommodation: creditsUsed / 2, food: creditsUsed / 2 };
  
  // Calculate accommodation discounts
  const seasonalDiscount = booking.seasonal_adjustment || 0;
  const durationDiscountPercent = booking.duration_discount_percent || 0;
  const discountCodePercent = booking.discount_code_percent ? Number(booking.discount_code_percent) : 0;
  
  // Determine discount code application scope
  // First check database field, then fall back to known codes list
  const discountCodeInfo = booking.applied_discount_code 
    ? knownDiscountCodes[booking.applied_discount_code] 
    : null;
  const discountCodeAppliesTo = booking.discount_code_applies_to || discountCodeInfo?.applies_to || 'total'; // default to total for unknown codes


  
  // Step-by-step calculation
  // 1. Accommodation discounts (seasonal + duration)
  const accommodationAfterSeasonal = accommodationBase - seasonalDiscount;
  const accommodationDurationDiscount = accommodationAfterSeasonal * (durationDiscountPercent / 100);
  const accommodationAfterDuration = accommodationAfterSeasonal - accommodationDurationDiscount;
  
  // 2. Food (duration discount already included in the chosen amount)
  const foodAfterDuration = foodBase; // Use the amount they actually chose


  
  // Calculate individual component breakdowns for display
  // Use database values when available (for new bookings), fall back to calculation for old bookings
  const accommodationFinalAmount = booking.accommodation_price_after_seasonal_duration ?? (accommodationBase - seasonalDiscount - accommodationDurationDiscount);
  const accommodationDiscountAmount = accommodationBase - accommodationFinalAmount;
  
  // Use rounded subtotal for accommodation if only seasonal discount is present
  const accommodationSubtotalDisplay = (durationDiscountPercent === 0 && accommodationDiscountAmount === seasonalDiscount)
    ? Math.round(accommodationFinalAmount)
    : Number(accommodationFinalAmount.toFixed(2));

  const accommodationBreakdown: BreakdownItem = {
    originalAmount: accommodationBase,
    discountAmount: accommodationDiscountAmount, // Use calculated difference to ensure accuracy
    creditsAmount: 0, // Don't show credits at component level
    finalAmount: accommodationFinalAmount // Use database value when available
  };
  
  // For food: NO discounts shown here (discount codes only apply to total)
  // Calculate F&F discount if code applies to F&F
  const foodDiscountAmount = (discountCodeAppliesTo === 'food_facilities' && discountCodePercent > 0)
    ? foodBase * (discountCodePercent / 100)
    : 0;

  const foodBreakdown: BreakdownItem = {
    originalAmount: foodBase,
    discountAmount: foodDiscountAmount, // Show discount only if code applies to F&F
    creditsAmount: 0, // Don't show credits at component level
    finalAmount: foodBase - foodDiscountAmount // Subtract discount if applicable
  };
  
  // Calculate total after seasonal/duration discounts
  // Now that accommodationBreakdown.finalAmount uses database values when available, we can always use the breakdown
  const totalAfterSeasonalDuration = accommodationBreakdown.finalAmount + foodBreakdown.finalAmount;
  
  // Use the displayed (rounded) accommodation subtotal in the total calculation row
  const totalAfterSeasonalDurationDisplay = accommodationSubtotalDisplay + foodBreakdown.finalAmount;

  // Calculate discount code amount based on what it applies to
  let discountCodeAmount = 0;
  if (discountCodePercent > 0 && booking.applied_discount_code) {
    if (discountCodeAppliesTo === 'food_facilities') {
      // Apply only to food & facilities portion
      discountCodeAmount = foodBase * (discountCodePercent / 100);
    } else if (discountCodeAppliesTo === 'accommodation') {
      // Apply only to accommodation portion AFTER seasonal/duration discounts
      discountCodeAmount = accommodationBreakdown.finalAmount * (discountCodePercent / 100);
    } else {
      // Apply to total (default behavior) -- use the displayed/rounded value for user-facing math
      discountCodeAmount = totalAfterSeasonalDurationDisplay * (discountCodePercent / 100);
    }
  }
  
  const totalAfterDiscountCode = totalAfterSeasonalDuration - discountCodeAmount;
  
  // Total shows the complete discount including discount codes
  const totalDiscountAmount = accommodationBreakdown.discountAmount + discountCodeAmount;
  
  const totalBreakdown: BreakdownItem = {
    originalAmount: totalBase,
    discountAmount: totalDiscountAmount,
    creditsAmount: creditsUsed,
    finalAmount: booking.total_price - creditsUsed
  };

  const BreakdownSection = ({ 
    title, 
    icon, 
    breakdown, 
    showIfZero = false,
    discountLabel,
    seasonalDiscount = 0,
    seasonalPercent = 0,
    durationDiscount = 0,
    durationPercent = 0,
    roundSubtotal = false
  }: { 
    title: string; 
    icon: React.ReactNode; 
    breakdown: BreakdownItem;
    showIfZero?: boolean;
    discountLabel?: string;
    seasonalDiscount?: number;
    seasonalPercent?: number;
    durationDiscount?: number;
    durationPercent?: number;
    roundSubtotal?: boolean;
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
          {/* Show seasonal discount if present */}
          {seasonalDiscount > 0 && (
            <div className="flex justify-between items-center text-emerald-600">
              <span className="flex items-center gap-1">
                <Percent className="w-3 h-3" />
                Seasonal discount{seasonalPercent ? ` (-${seasonalPercent.toFixed(1)}%)` : ''}
              </span>
              <span className="font-mono">-€{
                (durationDiscount === 0 && breakdown.discountAmount === seasonalDiscount)
                  ? Math.round(seasonalDiscount)
                  : seasonalDiscount.toFixed(2)
              }</span>
            </div>
          )}
          {/* Show duration discount if present */}
          {durationDiscount > 0 && (
            <div className="flex justify-between items-center text-emerald-600">
              <span className="flex items-center gap-1">
                <Percent className="w-3 h-3" />
                Duration discount{durationPercent ? ` (-${durationPercent.toFixed(1)}%)` : ''}
              </span>
              <span className="font-mono">-€{durationDiscount.toFixed(2)}</span>
            </div>
          )}
          {/* Show other discounts (e.g. code) if present */}
          {breakdown.discountAmount > 0 && !seasonalDiscount && !durationDiscount && (
            <div className="flex justify-between items-center text-emerald-600">
              <span className="flex items-center gap-1">
                <Percent className="w-3 h-3" />
                {discountLabel || 'Discounts Applied'}
              </span>
              <span className="font-mono">-€{breakdown.discountAmount.toFixed(2)}</span>
            </div>
          )}
          
          <div className="border-t border-[var(--color-border)] pt-2">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-[var(--color-text-primary)]">Subtotal</span>
              <span className="font-mono text-[var(--color-text-primary)]">
                €{roundSubtotal ? Math.round(Math.max(0, breakdown.finalAmount)) : Math.max(0, breakdown.finalAmount).toFixed(2)}
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
                seasonalDiscount={seasonalDiscount}
                seasonalPercent={booking.seasonal_discount_percent || 0}
                durationDiscount={accommodationDurationDiscount}
                durationPercent={durationDiscountPercent}
                roundSubtotal={true}
              />

              {/* Food & Facilities Breakdown */}
              <BreakdownSection
                title="Food & Facilities"
                icon={<Utensils className="w-4 h-4" />}
                breakdown={foodBreakdown}
                discountLabel={
                  discountCodeAmount > 0 && discountCodeAppliesTo === 'food_facilities'
                    ? `Discount code "${booking.applied_discount_code === 'UNKNOWN' ? 'Unknown code' : booking.applied_discount_code}"`
                    : undefined
                }
              />

              {/* Arrow pointing down */}
              <div className="flex justify-center py-2">
                <ArrowDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </div>

              {/* Step-by-step Total Calculation */}
              <div className="bg-[var(--color-bg-shade)] rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
                  <DollarSign className="w-4 h-4" />
                  Total Calculation
                </h4>
                
                <div className="space-y-2 text-sm">
                  {/* Step 1: Before discounts */}
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-text-secondary)]">Before discounts</span>
                    <span className="font-mono text-[var(--color-text-primary)]">€{(accommodationBase + foodBase).toFixed(2)}</span>
                  </div>
                  {/* Step 2: Seasonal discount */}
                  {seasonalDiscount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        Seasonal discount ({booking.seasonal_discount_percent ? `-${booking.seasonal_discount_percent.toFixed(1)}%` : ''})
                      </span>
                      <span className="font-mono">-€{
                        (accommodationSubtotalDisplay === Math.round(accommodationFinalAmount) && durationDiscountPercent === 0 && accommodationDiscountAmount === seasonalDiscount)
                          ? Math.round(seasonalDiscount)
                          : seasonalDiscount.toFixed(2)
                      }</span>
                    </div>
                  )}
                  {/* Step 2b: Discount code applied to food & facilities (explicit) */}
                  {discountCodeAmount > 0 && discountCodeAppliesTo === 'food_facilities' && (
                    <div className="flex justify-between items-center text-emerald-600">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        Discount code "{booking.applied_discount_code === 'UNKNOWN' ? 'Unknown code' : booking.applied_discount_code}" to food & facilities
                      </span>
                      <span className="font-mono">-€{formatDiscountCodeAmount(discountCodeAmount)}</span>
                    </div>
                  )}
                  {/* Step 3: Duration discount */}
                  {accommodationDurationDiscount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        Duration discount ({durationDiscountPercent ? `-${durationDiscountPercent.toFixed(1)}%` : ''})
                      </span>
                      <span className="font-mono">-€{accommodationDurationDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {/* Step 4: Sum of individual component amounts (use displayed/rounded subtotals) */}
                  {(discountCodeAmount > 0 && discountCodeAppliesTo !== 'food_facilities') || creditsUsed > 0 ? (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-secondary)]">After Seasonal + Duration Discounts</span>
                      <span className="font-mono text-[var(--color-text-primary)]">€{totalAfterSeasonalDurationDisplay % 1 === 0 ? totalAfterSeasonalDurationDisplay.toFixed(0) : totalAfterSeasonalDurationDisplay.toFixed(2)}</span>
                    </div>
                  ) : null}
                  
                  {/* Step 5: Discount code applied */}
                  {discountCodeAmount > 0 && discountCodeAppliesTo !== 'food_facilities' && (
                    <div className="flex justify-between items-start text-emerald-600">
                      <span className="flex items-center gap-1 flex-1 mr-2">
                        <Percent className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="break-words">
                          Code "{booking.applied_discount_code}" ({formatDiscountCodePercent(discountCodePercent)}%{
                            discountCodeAppliesTo === 'accommodation' ? ' on accommodation' :
                            ' on total'
                          })
                        </span>
                      </span>
                      <span className="font-mono flex-shrink-0">-€{formatDiscountCodeAmount(discountCodeAmount)}</span>
                    </div>
                  )}
                  
                  {/* Step 6: Show "After Discount Code" only if credits are also used */}
                  {discountCodeAmount > 0 && creditsUsed > 0 && (
                    <div className="flex justify-between items-center font-semibold border-t border-[var(--color-border)] pt-2">
                      <span className="text-[var(--color-text-primary)]">After Discount Code</span>
                      <span className="font-mono text-[var(--color-text-primary)]">€{totalAfterDiscountCode.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {/* Step 7: Credits applied */}
                  {creditsUsed > 0 && (
                    <div className="flex justify-between items-center text-blue-600">
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        Credits Applied
                      </span>
                      <span className="font-mono">-€{creditsUsed.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {/* Final amount */}
                  <div className="border-t border-[var(--color-border)] pt-2">
                    <div className="flex justify-between items-center font-bold text-lg">
                      <span className="text-[var(--color-text-primary)]">Final Amount Donated</span>
                      <span className="font-mono text-[var(--color-text-primary)]">
                        €{Math.max(0, totalBreakdown.finalAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Applied Discounts Details */}
              {(booking.applied_discount_code || seasonalDiscount > 0 || durationDiscountPercent > 0) && (
                <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Discount Details</h4>
                  <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
                    {seasonalDiscount > 0 && (
                      <p>• Seasonal discount: {booking.seasonal_discount_percent ? `${booking.seasonal_discount_percent.toFixed(1)}%` : 'Applied'} (accommodation only)</p>
                    )}
                    {durationDiscountPercent > 0 && (
                      <p>• Duration discount: {durationDiscountPercent.toFixed(1)}% (applied to accommodation; F&F range was pre-adjusted)</p>
                    )}
                    {booking.applied_discount_code && (
                      <p>• Code "{booking.applied_discount_code}": {formatDiscountCodePercent(discountCodePercent)}% 
                        ({discountCodeAppliesTo === 'food_facilities' ? 'applied to food & facilities only' : 
                          discountCodeAppliesTo === 'accommodation' ? 'applied to accommodation only' : 
                          'applied to total after seasonal/duration discounts'})
                      </p>
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