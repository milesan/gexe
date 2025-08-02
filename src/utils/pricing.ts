import { isBefore, differenceInDays, isAfter, addDays } from 'date-fns';
import { normalizeToUTCDate, calculateDurationDiscountWeeks } from './dates';
import { Accommodation } from '../types';
import { Week } from '../types/calendar';

// Helper function to centralize season logic based solely on date
function _getSeasonInfoByDate(date: Date): { name: string, baseDiscount: number } {
  const month = date.getUTCMonth();
  // Low Season (November-May)
  if (month <= 4 || month >= 10) return { name: 'Low Season', baseDiscount: 0.40 };
  // Medium Season (June, October)
  if (month === 5 || month === 9) return { name: 'Medium Season', baseDiscount: 0.15 };
  // Summer Season (July, August, September)
  return { name: 'Summer Season', baseDiscount: 0 };
}

export function getSeasonalDiscount(date: Date, accommodationType: string): number {
  // Dorm rooms don't get seasonal discounts, regardless of the actual season
  if (accommodationType?.toLowerCase().includes('dorm')) return 0;

  // For others, get the base discount for the season
  const seasonInfo = _getSeasonInfoByDate(date);
  return seasonInfo.baseDiscount;
}

export function getSeasonName(date: Date): string {
  // Get season name directly from the date, ignoring accommodation type
  const seasonInfo = _getSeasonInfoByDate(date);
  return seasonInfo.name;
}

export function getDurationDiscount(numberOfWeeks: number): number {
  // Round down to nearest whole week to determine discount tier
  const completeWeeks = Math.floor(numberOfWeeks);

  if (completeWeeks < 3) return 0;

  // Base discount for 3 weeks
  const baseDiscount = 0.10; // 10%

  // Additional discount for each week 3 and above
  if (completeWeeks >= 3) {
    const extraWeeks = completeWeeks - 3;
    const extraDiscount = (extraWeeks * 0.0278); // 2.78% per additional week
    const roundedDiscount = Math.round((baseDiscount + extraDiscount) * 100) / 100;
    // Cap at 35% (reached at 12 weeks)
    return Math.min(roundedDiscount, 0.35);
  }

  return baseDiscount;
}

export function getSeasonBreakdown(checkIn: Date, checkOut: Date): { hasMultipleSeasons: boolean, seasons: { name: string, discount: number, nights: number }[] } {
  // Normalize dates *immediately*
  const normCheckIn = normalizeToUTCDate(checkIn);
  const normCheckOut = normalizeToUTCDate(checkOut);
  // Initialize with all possible seasons, using base discounts for mapping
  // The 'discount' here represents the base seasonal discount, not the final applied discount
  const seasonMap: Record<string, { name: string, discount: number, nights: number }> = {
    'Low Season-0.4': { name: 'Low Season', discount: 0.4, nights: 0 },
    'Medium Season-0.15': { name: 'Medium Season', discount: 0.15, nights: 0 },
    'Summer Season-0': { name: 'Summer Season', discount: 0, nights: 0 }
  };

  if (isBefore(normCheckOut, normCheckIn)) {
    console.warn('[pricing] Check-out date is before check-in date in getSeasonBreakdown.');
    return {
      hasMultipleSeasons: false,
      seasons: Object.values(seasonMap) // Return initialized map structure
    };
  }

  const totalNights = differenceInDays(normCheckOut, normCheckIn);
  if (totalNights === 0) {
    return {
      hasMultipleSeasons: false,
      seasons: Object.values(seasonMap) // Return initialized map structure
    };
  }

  // Get all nights in the selected period (Manual UTC implementation)
  const allNights: Date[] = [];
  let currentDay = new Date(normCheckIn); // Start with a copy of the normalized check-in date
  // Loop while the current day is strictly before the normalized check-out date
  while (currentDay < normCheckOut) {
    allNights.push(new Date(currentDay)); // Add a copy of the current day (represents the night starting on this day)
    // Use addDays to avoid mutation and timezone issues
    currentDay = addDays(currentDay, 1);
  }
  // 'allNights' now contains Date objects for the start of each night in the period

  // Defensive check (optional but good practice)
  if (allNights.length === 0 && normCheckIn < normCheckOut) {
    console.warn('[getSeasonBreakdown] Generated zero nights for a valid interval:', { normCheckIn: normCheckIn.toISOString(), normCheckOut: normCheckOut.toISOString() });
  }

  // Count nights per season using the centralized logic
  allNights.forEach(night => {
    const seasonInfo = _getSeasonInfoByDate(night); // Use the helper
    const seasonName = seasonInfo.name;
    const baseDiscount = seasonInfo.baseDiscount;
    const key = `${seasonName}-${baseDiscount}`; // Key based on name and base discount
    console.log('[pricing] night:', night.toISOString());
    console.log('[pricing] seasonInfo:', seasonInfo);
    console.log('[pricing] seasonName:', seasonName);
    console.log('[pricing] baseDiscount:', baseDiscount);
    console.log('[pricing] key:', key);
    if (seasonMap[key]) {
      seasonMap[key].nights++;
    } else {
        // This case should ideally not be hit if seasonMap covers all possibilities from _getSeasonInfoByDate
        console.error(`[pricing] Encountered unexpected season key: ${key} for date ${night.toISOString()}. Check seasonMap initialization and _getSeasonInfoByDate logic.`);
    }
  });

  // Filter out seasons with zero nights and check if multiple seasons remain
  const seasonsWithNights = Object.values(seasonMap).filter(s => s.nights > 0);
  const hasMultipleSeasons = seasonsWithNights.length > 1;

  console.log('[pricing] Season breakdown calculated:', {
    hasMultipleSeasons,
    seasons: seasonsWithNights, // Return only seasons that actually occur in the interval
    totalNights,
    calculatedNights: seasonsWithNights.reduce((sum, s) => sum + s.nights, 0), // Sanity check
    checkIn: normCheckIn.toISOString(),
    checkOut: normCheckOut.toISOString()
  });

  // Return only the seasons that actually have nights in the stay
  return { hasMultipleSeasons, seasons: seasonsWithNights };
}

/**
 * Calculate the final weekly price for an accommodation after applying discounts.
 * @param accommodation The accommodation object
 * @param selectedWeeks Array of selected Week objects
 * @param averageSeasonalDiscount A pre-calculated average seasonal discount
 * @returns The final weekly price, rounded to the nearest integer.
 */
export function calculateWeeklyAccommodationPrice(
  accommodation: Accommodation,
  selectedWeeks: Week[],
  averageSeasonalDiscount: number
): number {
  const basePrice = accommodation.base_price ?? 0;

  if (basePrice === 0) {
    console.log('[calculateWeeklyAccommodationPrice] Base price is 0, returning 0.');
    return 0;
  }

  // CRITICAL FIX: Ensure we use rounded seasonal discount (consistent with display)
  const roundedSeasonalDiscount = Math.round(averageSeasonalDiscount * 100) / 100;

  // 2. Calculate Duration Discount Percentage (using COMPLETE weeks)
  const completeWeeks = calculateDurationDiscountWeeks(selectedWeeks);
  const durationDiscountPercent = getDurationDiscount(completeWeeks); // Uses Math.floor internally
    // 3. Apply discounts multiplicatively using ROUNDED seasonal discount
  const finalPrice = basePrice * (1 - roundedSeasonalDiscount) * (1 - durationDiscountPercent);
  const roundedFinalPrice = Math.round(finalPrice);
  return roundedFinalPrice;
}

/**
 * Calculate weeks for pricing purposes - always uses exact calculation
 * This ensures pricing is precise and doesn't change based on display rounding
 */
export function calculatePricingWeeksFromDates(startDate: Date, endDate: Date): number {
  // Import the helper we created
  const { normalizeToUTCDate } = require('./dates');
  
  const startUTC = normalizeToUTCDate(startDate);
  const endUTC = normalizeToUTCDate(endDate);
  
  const timeDiff = endUTC.getTime() - startUTC.getTime();
  const nights = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const exactWeeks = nights / 7;
  
  console.log('[calculatePricingWeeksFromDates] Pricing week calculation:', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(), 
    nights,
    exactWeeks,
    note: 'Used for precise pricing calculations'
  });
  
  return exactWeeks;
}

/**
 * Determine if a booking duration should be considered "standard" weeks
 * This helps identify when business rounding should apply
 */
export function isStandardWeekDuration(startDate: Date, endDate: Date): boolean {
  const { normalizeToUTCDate } = require('./dates');
  
  const startUTC = normalizeToUTCDate(startDate);
  const endUTC = normalizeToUTCDate(endDate);
  
  const timeDiff = endUTC.getTime() - startUTC.getTime();
  const nights = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  // Check if it's a multiple of 7 days (standard week)
  const isExactWeeks = nights % 7 === 0;
  
  // Check if it's close to a multiple of 7 days (within 1 day)
  const remainder = nights % 7;
  const closeToWeeks = remainder <= 1 || remainder >= 6;
  
  console.log('[isStandardWeekDuration] Duration analysis:', {
    nights,
    isExactWeeks,
    remainder,
    closeToWeeks,
    isStandard: isExactWeeks || closeToWeeks
  });
  
  return isExactWeeks || closeToWeeks;
}