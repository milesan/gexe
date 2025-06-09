import { useMemo } from 'react';
import { getSeasonalDiscount, getDurationDiscount, getSeasonBreakdown } from '../../utils/pricing';
import { calculateTotalNights, calculateDurationDiscountWeeks, calculateTotalDays, calculateTotalWeeksDecimal } from '../../utils/dates';
import { calculateBaseFoodCost } from './BookingSummary.utils';
import type { Week } from '../../types/calendar';
import type { Accommodation } from '../../types';
import type { PricingDetails, AppliedDiscount } from './BookingSummary.types';

interface UsePricingProps {
  selectedWeeks: Week[];
  selectedAccommodation: Accommodation | null;
  calculatedWeeklyAccommodationPrice: number | null;
  foodContribution: number | null;
  appliedDiscount: AppliedDiscount | null;
}

export function usePricing({
  selectedWeeks,
  selectedAccommodation,
  calculatedWeeklyAccommodationPrice,
  foodContribution,
  appliedDiscount
}: UsePricingProps): PricingDetails {
  return useMemo((): PricingDetails => {
    console.log('[BookingSummary] --- Recalculating Pricing (useMemo) ---');
    console.log('[BookingSummary] useMemo Inputs:', {
      selectedWeeksLength: selectedWeeks.length,
      selectedAccommodationId_Prop: selectedAccommodation?.id,
      calculatedWeeklyAccommodationPrice_Prop: calculatedWeeklyAccommodationPrice,
      foodContribution,
      appliedDiscount,
    });
    // --- ADDED LOGGING: Check prop value *inside* memo ---
    console.log('[BookingSummary] useMemo: Using calculatedWeeklyAccommodationPrice PROP:', calculatedWeeklyAccommodationPrice);
    // --- END ADDED LOGGING ---

    // === Calculate fundamental values: nights, complete weeks (for discount), exact decimal weeks ===
    const totalNights = calculateTotalNights(selectedWeeks);
    const completeWeeks = calculateDurationDiscountWeeks(selectedWeeks); // Uses floor(days/7)
    const exactWeeksDecimal = calculateTotalWeeksDecimal(selectedWeeks); // Returns full precision days/7

    // === NEW: Calculate weeks rounded for display (WYSIWYG) ===
    const displayWeeks = selectedWeeks.length > 0 ? Math.round(exactWeeksDecimal * 10) / 10 : 0;
    console.log('[BookingSummary] useMemo: Calculated Weeks:', { totalNights, completeWeeks, exactWeeksDecimal, displayWeeks });

    // === Calculate Accommodation Cost using DISPLAY (rounded) weeks for WYSIWYG ===
    const weeklyAccPrice = calculatedWeeklyAccommodationPrice ?? 0;

    // --- ADDED LOGGING: Check inputs before multiplication ---
    console.log('[BookingSummary] useMemo: Inputs for Accommodation Cost CALCULATION:', {
      weeklyAccPrice_Used: weeklyAccPrice, // Value used in calculation
      displayWeeks_Multiplier: displayWeeks, // The multiplier
    });
    // --- END ADDED LOGGING ---

    const totalAccommodationCost = parseFloat((weeklyAccPrice * displayWeeks).toFixed(2));
    console.log('[BookingSummary] useMemo: Calculated Accommodation Cost (using DISPLAY weeks):', { weeklyAccPrice, displayWeeks, totalAccommodationCost });
    // VERIFICATION LOG (keeping for now, should show integer * rounded_decimal)
    console.log('[BookingSummary] useMemo: VERIFYING Cost Calc:', {
        integerWeeklyRate: weeklyAccPrice, // Should be integer
        decimalWeeks: exactWeeksDecimal, // Should be decimal
        calculatedTotal: totalAccommodationCost // Result of integer * decimal
    });

    // === Calculate BASE Food Cost using DISPLAY (rounded) weeks ===
    const { totalBaseFoodCost, effectiveWeeklyRate } = calculateBaseFoodCost(
        totalNights, // Pass totalNights
        displayWeeks, // Pass rounded display weeks
        foodContribution
    );
    console.log('[BookingSummary] useMemo: Calculated Base Food Cost (based on rounded display weeks):', { totalBaseFoodCost, effectiveWeeklyRate });

    // === Determine Duration Discount % using COMPLETE weeks ===
    const rawDurationDiscountPercent = getDurationDiscount(completeWeeks);
    // === NEW: Round the discount factor to match display (WYSIWYG) ===
    console.log('[BookingSummary] useMemo: Determined Duration Discount % (using complete weeks):', { rawDurationDiscountPercent });

    // === Apply ROUNDED Discount % to BASE Food Cost (which was calculated using rounded weeks) ===
    // 1. Calculate the effective *integer* weekly F&F cost *after* discount (matching slider display)
    const baseWeeklyRateForCalc = foodContribution ?? (totalNights <= 6 ? 345 : 240); // Get base rate from slider or default
    const displayedWeeklyFFCost = Math.round(baseWeeklyRateForCalc * (1 - rawDurationDiscountPercent));
    // 2. Multiply this displayed weekly cost by the displayed number of weeks
    const finalFoodCost = parseFloat((displayedWeeklyFFCost * displayWeeks).toFixed(2));
    // 3. Recalculate the discount amount based on the difference (for display/info purposes)
    const foodDiscountAmount = parseFloat((totalBaseFoodCost - finalFoodCost).toFixed(2)); // Base cost (base rate * display weeks) - final cost

    console.log('[BookingSummary] useMemo: Calculated Final Food Cost (WYSIWYG):', { 
      baseWeeklyRateForCalc,
      rawDurationDiscountPercent, 
      displayedWeeklyFFCost, // Integer weekly cost after discount
      displayWeeks, // Decimal weeks display
      finalFoodCost, // displayedWeeklyFFCost * displayWeeks
      totalBaseFoodCost, // For comparison
      foodDiscountAmount // Recalculated difference
    });

    // 4. Combine results
    const subtotal = parseFloat((+totalAccommodationCost + +finalFoodCost).toFixed(2));
    console.log('[BookingSummary] useMemo: Calculated Subtotal:', { totalAccommodationCost, finalFoodCost, subtotal });

    // --- START: Apply Discount Code --- 
    let finalTotalAmount = subtotal;
    let discountCodeAmount = 0;
    let subtotalBeforeDiscountCode = subtotal; // Store the subtotal before this specific discount code

    if (appliedDiscount && subtotalBeforeDiscountCode > 0) {
        const discountPercentage = appliedDiscount.percentage_discount / 100;
        const appliesTo = appliedDiscount.applies_to || 'total'; // Default to 'total' for safety

        let amountToDiscountFrom = 0;

        if (appliesTo === 'accommodation') {
            amountToDiscountFrom = totalAccommodationCost;
        } else if (appliesTo === 'food_facilities') {
            amountToDiscountFrom = finalFoodCost; // This is F&F cost after duration discount but before code discount
        } else { // 'total' or any other fallback
            amountToDiscountFrom = subtotalBeforeDiscountCode;
        }

        if (amountToDiscountFrom > 0) { // Only calculate discount if the target component has a cost
            discountCodeAmount = parseFloat((amountToDiscountFrom * discountPercentage).toFixed(2));
        } else {
            discountCodeAmount = 0; // No discount if the target component is free or N/A
        }
        
        // The final total amount is the original subtotal (before this code) minus the calculated discount code amount.
        finalTotalAmount = parseFloat((subtotalBeforeDiscountCode - discountCodeAmount).toFixed(2));

        // Ensure total doesn't go below zero
        if (finalTotalAmount < 0) finalTotalAmount = 0;

        console.log('[BookingSummary] useMemo: Applied Discount Code:', {
            code: appliedDiscount.code,
            percentage: appliedDiscount.percentage_discount,
            appliesTo: appliesTo,
            amountComponentTargeted: amountToDiscountFrom, // Log the base amount for discount calculation
            subtotalBeforeCodeDiscount: subtotalBeforeDiscountCode,
            discountCodeAmountApplied: discountCodeAmount,
            finalTotalAmountAfterCodeDiscount: finalTotalAmount
        });
    } else {
         console.log('[BookingSummary] useMemo: No discount code applied or subtotal is zero.');
    }
    // --- END: Apply Discount Code ---

    // --- START: Calculate VAT (24%) ---
    const vatRate = 0.24; // 24% VAT
    const vatAmount = parseFloat((finalTotalAmount * vatRate).toFixed(2));
    const totalWithVat = parseFloat((finalTotalAmount + vatAmount).toFixed(2));
    
    console.log('[BookingSummary] useMemo: VAT Calculation:', {
      finalTotalAmount,
      vatRate,
      vatAmount,
      totalWithVat
    });
    // --- END: Calculate VAT ---

    // 5. Construct the final object
    const calculatedPricingDetails: PricingDetails = {
      totalNights,
      totalAccommodationCost,
      totalFoodAndFacilitiesCost: finalFoodCost,
      subtotal,
      totalAmount: finalTotalAmount,
      appliedCodeDiscountValue: discountCodeAmount,
      weeksStaying: displayWeeks,
      effectiveBaseRate: effectiveWeeklyRate,
      nightlyAccommodationRate: totalNights > 0 ? +(totalAccommodationCost / totalNights).toFixed(2) : 0,
      baseAccommodationRate: selectedAccommodation?.base_price || 0,
      durationDiscountAmount: foodDiscountAmount,
      durationDiscountPercent: rawDurationDiscountPercent * 100,
      seasonalDiscount: 0,
      vatAmount,
      totalWithVat,
    };

    // ADDED LOG BLOCK: Values right before returning details
    console.log('[BookingSummary] useMemo: Final Calculation Values for Food Cost', {
      displayWeeks, // The rounded weeks used
      foodContribution, // The input from the slider
      totalBaseFoodCost, // displayWeeks * foodContribution
      completeWeeks, // For discount lookup
      rawDurationDiscountPercent, // Raw discount %
      finalFoodCost_unrounded: finalFoodCost, // Base * (1 - Discount) BEFORE final display rounding
    });

    // --- START TEST ACCOMMODATION OVERRIDE ---
    if (selectedAccommodation?.type === 'test') {
      console.log('[BookingSummary] useMemo: OVERRIDING costs for TEST accommodation.');
      calculatedPricingDetails.totalFoodAndFacilitiesCost = 0;
      calculatedPricingDetails.subtotal = calculatedPricingDetails.totalAccommodationCost; // Keep accom cost, just zero out food
      calculatedPricingDetails.totalAmount = calculatedPricingDetails.totalAccommodationCost; // Total is just accom cost
      calculatedPricingDetails.durationDiscountAmount = 0; // No food discount applicable
      // Recalculate VAT for test accommodation
      calculatedPricingDetails.vatAmount = parseFloat((calculatedPricingDetails.totalAmount * vatRate).toFixed(2));
      calculatedPricingDetails.totalWithVat = parseFloat((calculatedPricingDetails.totalAmount + calculatedPricingDetails.vatAmount).toFixed(2));
    }
    // --- END TEST ACCOMMODATION OVERRIDE ---

    console.log('[BookingSummary] useMemo: Pricing calculation COMPLETE. Result:', calculatedPricingDetails);
    console.log('[BookingSummary] --- Finished Pricing Recalculation (useMemo) ---');
    return calculatedPricingDetails;

  }, [selectedWeeks, calculatedWeeklyAccommodationPrice, foodContribution, selectedAccommodation, appliedDiscount]);
}