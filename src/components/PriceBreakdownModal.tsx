import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, Home, Utensils, DollarSign, CreditCard, Percent, ArrowDown, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Payment {
  id: string;
  booking_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  amount_paid: number;
  breakdown_json: any | null;
  discount_code: string | null;
  payment_type: string;
  stripe_payment_id: string | null;
  created_at: string;
  updated_at: string;
  status: string;
}

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
    payments?: Payment[];
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
  // Show as percent (e.g., 0.16 -> 16.0)
  return (percent * 100).toFixed(1);
}

// Helper to format discount code amount: up to 2 decimals, no trailing zeros
function formatDiscountCodeAmount(amount: number) {
  if (amount == null) return '';
  return amount.toFixed(2).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '').replace(/\.$/, '');
}

export function PriceBreakdownModal({ isOpen, onClose, booking }: PriceBreakdownModalProps) {
  if (!isOpen) return null;

  // State for tracking which payments are expanded
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());

  // Toggle payment expansion
  const togglePayment = (paymentId: string) => {
    setExpandedPayments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };

  // DEBUG: Log the booking data to see what we're working with
  console.log('[PriceBreakdownModal] Booking data:', {
    hasPayments: !!booking.payments,
    paymentsCount: booking.payments?.length || 0,
    payments: booking.payments?.map(p => ({
      id: p.id,
      hasBreakdownJson: !!p.breakdown_json,
      breakdownJsonType: typeof p.breakdown_json,
      breakdownJsonValue: p.breakdown_json
    }))
  });

  // STRICT PAYMENTS-ONLY APPROACH: Only use breakdown_json from payments table
  const hasPaymentsData = booking.payments && booking.payments.length > 0;
  
  // Show all payments separately
  const validPayments = hasPaymentsData 
    ? booking.payments!.filter(p => p.breakdown_json)
    : [];

  const hasValidBreakdown = validPayments.length > 0;

  console.log('[PriceBreakdownModal] Breakdown check:', {
    hasPaymentsData,
    validPaymentsCount: validPayments.length,
    hasValidBreakdown
  });

  if (!hasValidBreakdown) {
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
                <p className="text-sm mt-2">
                  {!hasPaymentsData 
                    ? "This booking was created before our payment tracking system was implemented."
                    : "Payment data exists but detailed breakdown information is missing."
                  }
                </p>
                <p className="text-xs mt-3 text-[var(--color-text-tertiary)]">
                  Only bookings made after our latest pricing system update include detailed breakdowns.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Helper function to calculate breakdown for a single payment
  const calculatePaymentBreakdown = (payment: Payment) => {
    console.log('[PriceBreakdownModal] calculatePaymentBreakdown called with payment:', {
      id: payment.id,
      breakdownJsonType: typeof payment.breakdown_json,
      breakdownJsonValue: payment.breakdown_json
    });

    // Handle case where breakdown_json might be a string that needs parsing
    let breakdownData;
    if (typeof payment.breakdown_json === 'string') {
      try {
        breakdownData = JSON.parse(payment.breakdown_json);
        console.log('[PriceBreakdownModal] Successfully parsed breakdown_json string:', breakdownData);
      } catch (error) {
        console.error('[PriceBreakdownModal] Failed to parse breakdown_json string:', error);
        return null;
      }
    } else {
      breakdownData = payment.breakdown_json;
      console.log('[PriceBreakdownModal] Using breakdown_json as object:', breakdownData);
    }
    
    if (!breakdownData) {
      console.error('[PriceBreakdownModal] No breakdown data available');
      return null;
    }
    
    // accommodation in JSON is the amount paid AFTER discounts
    // Use stored original price if available, otherwise reverse-calculate
    const accommodationPaid = breakdownData.accommodation || 0;
    const seasonalDiscountPercent = breakdownData.seasonal_discount_percent || 0;
    const durationDiscountPercent = breakdownData.duration_discount_percent || 0;
    
    // Use stored original accommodation price if available (newer payments)
    // Otherwise reverse-calculate for older payments
    let accommodationBase: number;
    if (breakdownData.accommodation_original !== undefined) {
      accommodationBase = breakdownData.accommodation_original;
    } else {
      // Reverse-calculate original accommodation amount for older payments
      // Final amount = Original * (1 - seasonal) * (1 - duration)
      // So Original = Final / ((1 - seasonal) * (1 - duration))
      accommodationBase = accommodationPaid / ((1 - seasonalDiscountPercent) * (1 - durationDiscountPercent));
    }
    
    const foodBase = breakdownData.food_facilities || 0;
    const creditsUsed = breakdownData.credits_used || 0;
    const discountCodePercent = breakdownData.discount_code_percent || 0;
    const discountCodeAppliesTo = breakdownData.discount_code_applies_to || 'total';
    const paymentDiscountCode = payment.discount_code ?? null;
    const appliedDiscountCode = breakdownData.discount_code || paymentDiscountCode;
    
    const totalBase = accommodationBase + foodBase;

    // Credits allocation: 50/50 split if both components exist, otherwise all to the existing component
    const creditsPerComponent = accommodationBase === 0 && foodBase > 0 
      ? { accommodation: 0, food: creditsUsed }
      : foodBase === 0 && accommodationBase > 0
      ? { accommodation: creditsUsed, food: 0 }
      : { accommodation: creditsUsed / 2, food: creditsUsed / 2 };
    
    // Calculate actual discount amounts by taking the difference between original and final
    // and proportionally splitting based on discount percentages
    const totalDiscountDifference = accommodationBase - accommodationPaid;
    
    // Calculate proportional split of the total discount difference
    let seasonalDiscount = 0;
    let accommodationDurationDiscount = 0;
    
    if (totalDiscountDifference > 0 && (seasonalDiscountPercent > 0 || durationDiscountPercent > 0)) {
      const totalDiscountPercent = seasonalDiscountPercent + durationDiscountPercent;
      
      if (totalDiscountPercent > 0) {
        // Split proportionally based on discount percentages
        seasonalDiscount = totalDiscountDifference * (seasonalDiscountPercent / totalDiscountPercent);
        accommodationDurationDiscount = totalDiscountDifference * (durationDiscountPercent / totalDiscountPercent);
      }
    }
    
    // Determine discount code application scope
    const discountCodeInfo = appliedDiscountCode 
      ? knownDiscountCodes[appliedDiscountCode] 
      : null;

    // Step-by-step calculation using payment breakdown data
    // 1. Accommodation discounts (seasonal + duration)
    const accommodationAfterSeasonal = accommodationBase - seasonalDiscount;
    const accommodationAfterDuration = accommodationAfterSeasonal - accommodationDurationDiscount;
    
    // 2. Food (duration discount already included in the chosen amount)
    const foodAfterDuration = foodBase; // Use the amount they actually chose

    // Calculate individual component breakdowns for display
    const accommodationFinalAmount = accommodationBase - seasonalDiscount - accommodationDurationDiscount;
    const accommodationDiscountAmount = accommodationBase - accommodationFinalAmount;
    
    // Use rounded subtotal for accommodation if only seasonal discount is present
    const accommodationSubtotalDisplay = (durationDiscountPercent === 0 && accommodationDiscountAmount === seasonalDiscount)
      ? Math.round(accommodationFinalAmount)
      : Number(accommodationFinalAmount.toFixed(2));

    const accommodationBreakdown: BreakdownItem = {
      originalAmount: accommodationBase,
      discountAmount: accommodationDiscountAmount,
      creditsAmount: 0, // Don't show credits at component level
      finalAmount: accommodationFinalAmount
    };
    
    // For food: Calculate F&F discount if code applies to F&F
    const foodDiscountAmount = (discountCodeAppliesTo === 'food_facilities' && discountCodePercent > 0)
      ? foodBase * discountCodePercent
      : 0;

    const foodBreakdown: BreakdownItem = {
      originalAmount: foodBase,
      discountAmount: foodDiscountAmount, // Show discount only if code applies to F&F
      creditsAmount: 0, // Don't show credits at component level
      finalAmount: foodBase - foodDiscountAmount // Subtract discount if applicable
    };
    
    // Calculate total after seasonal/duration discounts
    const totalAfterSeasonalDuration = accommodationBreakdown.finalAmount + foodBreakdown.finalAmount;
    
    // Use the displayed (rounded) accommodation subtotal in the total calculation row
    const totalAfterSeasonalDurationDisplay = accommodationSubtotalDisplay + foodBreakdown.finalAmount;

    // Calculate discount code amount based on what it applies to
    let discountCodeAmount = 0;
    if (discountCodePercent > 0 && appliedDiscountCode) {
      if (discountCodeAppliesTo === 'food_facilities') {
        // Apply only to food & facilities portion
        discountCodeAmount = foodBase * discountCodePercent;
      } else if (discountCodeAppliesTo === 'accommodation') {
        // Apply only to accommodation portion AFTER seasonal/duration discounts
        discountCodeAmount = accommodationBreakdown.finalAmount * discountCodePercent;
      } else {
        // Apply to total (default behavior) -- use the displayed/rounded value for user-facing math
        discountCodeAmount = totalAfterSeasonalDurationDisplay * discountCodePercent;
      }
    }
    
    const totalAfterDiscountCode = totalAfterSeasonalDuration - discountCodeAmount;
    
    // Total shows the complete discount including discount codes
    const totalDiscountAmount = accommodationBreakdown.discountAmount + discountCodeAmount;
    
    const totalBreakdown: BreakdownItem = {
      originalAmount: totalBase,
      discountAmount: totalDiscountAmount,
      creditsAmount: creditsUsed,
      finalAmount: payment.amount_paid
    };

    return {
      payment,
      breakdownData,
      accommodationBase,
      foodBase,
      creditsUsed,
      seasonalDiscountPercent,
      durationDiscountPercent,
      discountCodePercent,
      discountCodeAppliesTo,
      appliedDiscountCode,
      totalBase,
      creditsPerComponent,
      seasonalDiscount,
      discountCodeInfo,
      accommodationAfterSeasonal,
      accommodationDurationDiscount,
      accommodationAfterDuration,
      foodAfterDuration,
      accommodationFinalAmount,
      accommodationDiscountAmount,
      accommodationSubtotalDisplay,
      accommodationBreakdown,
      foodDiscountAmount,
      foodBreakdown,
      totalAfterSeasonalDuration,
      totalAfterSeasonalDurationDisplay,
      discountCodeAmount,
      totalAfterDiscountCode,
      totalDiscountAmount,
      totalBreakdown
    };
  };

  const BreakdownSection = ({ 
    title, 
    icon, 
    breakdown, 
    showIfZero = false,
    discountLabel,
    seasonalDiscount = 0,
    seasonalDiscountPercent = 0,
    durationDiscount = 0,
    durationDiscountPercent = 0,
    roundSubtotal = false
  }: { 
    title: string; 
    icon: React.ReactNode; 
    breakdown: BreakdownItem;
    showIfZero?: boolean;
    discountLabel?: string;
    seasonalDiscount?: number;
    seasonalDiscountPercent?: number;
    durationDiscount?: number;
    durationDiscountPercent?: number;
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
                Seasonal discount{seasonalDiscountPercent ? ` (-${(seasonalDiscountPercent * 100).toFixed(1)}%)` : ''}
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
                Duration discount{durationDiscountPercent ? ` (-${(durationDiscountPercent * 100).toFixed(1)}%)` : ''}
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

              {validPayments.map((payment, index) => {
                const breakdown = calculatePaymentBreakdown(payment);
                const paymentDate = new Date(payment.created_at).toISOString().split('T')[0];
                const paymentType = payment.payment_type === 'initial' ? 'Initial Donation' : 
                                  payment.payment_type === 'extension' ? 'Extension Donation' : 
                                  payment.payment_type;
                
                // Skip rendering if breakdown calculation failed
                if (!breakdown) {
                  console.error('[PriceBreakdownModal] Failed to calculate breakdown for payment:', payment.id);
                  return null;
                }
                
                return (
                  <div key={payment.id} className="space-y-4">
                    {/* Payment Header */}
                    <div 
                      className="bg-[var(--color-bg-shade)] rounded-lg p-4 border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-surface)] transition-colors"
                      onClick={() => togglePayment(payment.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold text-[var(--color-text-primary)]">{paymentType}</h4>
                          <p className="text-sm text-[var(--color-text-secondary)]">{paymentDate}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-mono font-semibold text-[var(--color-text-primary)]">€{payment.amount_paid.toFixed(2)}</p>
                            <p className="text-xs text-[var(--color-text-tertiary)]">{payment.start_date} - {payment.end_date}</p>
                          </div>
                          {expandedPayments.has(payment.id) ? (
                            <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Breakdown Content */}
                    <AnimatePresence>
                      {expandedPayments.has(payment.id) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-4">
                    {/* Accommodation Breakdown */}
                    <BreakdownSection
                      title="Accommodation"
                      icon={<Home className="w-4 h-4" />}
                      breakdown={breakdown.accommodationBreakdown}
                      seasonalDiscount={breakdown.seasonalDiscount}
                      seasonalDiscountPercent={breakdown.seasonalDiscountPercent}
                      durationDiscount={breakdown.accommodationDurationDiscount}
                      durationDiscountPercent={breakdown.durationDiscountPercent}
                      roundSubtotal={true}
                    />

                    {/* Food & Facilities Breakdown */}
                    <BreakdownSection
                      title="Food & Facilities"
                      icon={<Utensils className="w-4 h-4" />}
                      breakdown={breakdown.foodBreakdown}
                      discountLabel={
                        breakdown.discountCodeAmount > 0 && breakdown.discountCodeAppliesTo === 'food_facilities'
                          ? `Discount code "${breakdown.appliedDiscountCode === 'UNKNOWN' ? 'Unknown code' : breakdown.appliedDiscountCode}"`
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
                          <span className="font-mono text-[var(--color-text-primary)]">€{(breakdown.accommodationBase + breakdown.foodBase).toFixed(2)}</span>
                        </div>
                        {/* Step 2: Seasonal discount */}
                        {breakdown.seasonalDiscount > 0 && (
                          <div className="flex justify-between items-center text-emerald-600">
                            <span className="flex items-center gap-1">
                              <Percent className="w-3 h-3" />
                              Seasonal discount ({breakdown.seasonalDiscountPercent ? `-${(breakdown.seasonalDiscountPercent * 100).toFixed(1)}%` : ''})
                            </span>
                            <span className="font-mono">-€{
                              (breakdown.accommodationSubtotalDisplay === Math.round(breakdown.accommodationFinalAmount) && breakdown.durationDiscountPercent === 0 && breakdown.accommodationDiscountAmount === breakdown.seasonalDiscount)
                                ? Math.round(breakdown.seasonalDiscount)
                                : breakdown.seasonalDiscount.toFixed(2)
                            }</span>
                          </div>
                        )}
                        {/* Step 2b: Discount code applied to food & facilities (explicit) */}
                        {breakdown.discountCodeAmount > 0 && breakdown.discountCodeAppliesTo === 'food_facilities' && (
                          <div className="flex justify-between items-center text-emerald-600">
                            <span className="flex items-center gap-1">
                              <Percent className="w-3 h-3" />
                              Discount code "{breakdown.appliedDiscountCode === 'UNKNOWN' ? 'Unknown code' : breakdown.appliedDiscountCode}" to food & facilities
                            </span>
                            <span className="font-mono">-€{formatDiscountCodeAmount(breakdown.discountCodeAmount)}</span>
                          </div>
                        )}
                        {/* Step 3: Duration discount */}
                        {breakdown.accommodationDurationDiscount > 0 && (
                          <div className="flex justify-between items-center text-emerald-600">
                            <span className="flex items-center gap-1">
                              <Percent className="w-3 h-3" />
                              Duration discount ({breakdown.durationDiscountPercent ? `-${(breakdown.durationDiscountPercent * 100).toFixed(1)}%` : ''})
                            </span>
                            <span className="font-mono">-€{breakdown.accommodationDurationDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        {/* Step 4: Sum of individual component amounts (use displayed/rounded subtotals) */}
                        {(breakdown.discountCodeAmount > 0 && breakdown.discountCodeAppliesTo !== 'food_facilities') || breakdown.creditsUsed > 0 ? (
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--color-text-secondary)]">After Seasonal + Duration Discounts</span>
                            <span className="font-mono text-[var(--color-text-primary)]">€{breakdown.totalAfterSeasonalDurationDisplay % 1 === 0 ? breakdown.totalAfterSeasonalDurationDisplay.toFixed(0) : breakdown.totalAfterSeasonalDurationDisplay.toFixed(2)}</span>
                          </div>
                        ) : null}
                        
                        {/* Step 5: Discount code applied */}
                        {breakdown.discountCodeAmount > 0 && breakdown.discountCodeAppliesTo !== 'food_facilities' && (
                          <div className="flex justify-between items-start text-emerald-600">
                            <span className="flex items-center gap-1 flex-1 mr-2">
                              <Percent className="w-3 h-3 flex-shrink-0 mt-0.5" />
                              <span className="break-words">
                                Code "{breakdown.appliedDiscountCode}" ({formatDiscountCodePercent(breakdown.discountCodePercent)}%{
                                  breakdown.discountCodeAppliesTo === 'accommodation' ? ' on accommodation' :
                                  ' on total'
                                })
                              </span>
                            </span>
                            <span className="font-mono flex-shrink-0">-€{formatDiscountCodeAmount(breakdown.discountCodeAmount)}</span>
                          </div>
                        )}
                        
                        {/* Step 6: Show "After Discount Code" only if credits are also used */}
                        {breakdown.discountCodeAmount > 0 && breakdown.creditsUsed > 0 && (
                          <div className="flex justify-between items-center font-semibold border-t border-[var(--color-border)] pt-2">
                            <span className="text-[var(--color-text-primary)]">After Discount Code</span>
                            <span className="font-mono text-[var(--color-text-primary)]">€{breakdown.totalAfterDiscountCode.toFixed(2)}</span>
                          </div>
                        )}
                        
                        {/* Step 7: Credits applied */}
                        {breakdown.creditsUsed > 0 && (
                          <div className="flex justify-between items-center text-blue-600">
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              Credits Applied
                            </span>
                            <span className="font-mono">-€{breakdown.creditsUsed.toFixed(2)}</span>
                          </div>
                        )}
                        
                        {/* Final amount */}
                        <div className="border-t border-[var(--color-border)] pt-2">
                          <div className="flex justify-between items-center font-bold text-lg">
                            <span className="text-[var(--color-text-primary)]">Final Amount Donated</span>
                            <span className="font-mono text-[var(--color-text-primary)]">
                              €{Math.max(0, breakdown.totalBreakdown.finalAmount).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Applied Discounts Details */}
                    {(breakdown.appliedDiscountCode || breakdown.seasonalDiscount > 0 || breakdown.durationDiscountPercent > 0) && (
                      <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Discount Details</h4>
                        <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
                          {breakdown.seasonalDiscount > 0 && (
                            <p>• Seasonal discount: {breakdown.seasonalDiscountPercent ? `-${(breakdown.seasonalDiscountPercent * 100).toFixed(1)}%` : 'Applied'} (accommodation only)</p>
                          )}
                          {breakdown.durationDiscountPercent > 0 && (
                            <p>• Duration discount: {breakdown.durationDiscountPercent ? `-${(breakdown.durationDiscountPercent * 100).toFixed(1)}%` : 'Applied'} (applied to accommodation; F&F range was pre-adjusted)</p>
                          )}
                          {breakdown.appliedDiscountCode && (
                            <p>• Code "{breakdown.appliedDiscountCode}": {formatDiscountCodePercent(breakdown.discountCodePercent)}% 
                              ({breakdown.discountCodeAppliesTo === 'food_facilities' ? 'applied to food & facilities only' : 
                                breakdown.discountCodeAppliesTo === 'accommodation' ? 'applied to accommodation only' : 
                                'applied to total after seasonal/duration discounts'})
                            </p>
                          )}
                          {breakdown.creditsUsed > 0 && (
                            <p>• Credits allocated: €{breakdown.creditsPerComponent.accommodation.toFixed(2)} accommodation, €{breakdown.creditsPerComponent.food.toFixed(2)} food</p>
                          )}
                        </div>
                      </div>
                    )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* Add separator between payments (except for the last one) */}
                    {index < validPayments.length - 1 && (
                      <div className="border-t-2 border-[var(--color-border)] my-8"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 