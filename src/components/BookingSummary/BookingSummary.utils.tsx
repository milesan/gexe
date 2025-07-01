import React from 'react';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { Week } from '../../types/calendar';

// Helper function to format numbers without decimal points when they're integers
export const formatNumber = (num: number, decimals: number = 1): string => {
  // Check if the number is an integer
  if (Number.isInteger(num)) {
    return num.toString();
  }
  return num.toFixed(decimals);
};

// Helper function to format price display, showing "Free" for zero
// UPDATED: Dont round
export const formatPriceDisplay = (price: number): React.ReactNode => {
  console.log('[formatPriceDisplay] Input price:', price);
  if (price === 0) {
    return <span className="text-accent-primary text-xl font-mono">Free</span>;
  }

  // Check if the price is a whole number
  if (Number.isInteger(price)) {
    return `€${price}`;
  }

  // Return the price with two decimal places
  return `€${price.toFixed(2)}`;
};

// === REVISED HELPER ===
// Accepts pre-calculated rounded weeks for consistency with display
export const calculateBaseFoodCost = (
  totalNights: number, // Pass totalNights in
  displayWeeks: number, // Use the rounded weeks for calculation
  foodContribution?: number | null
): { totalBaseFoodCost: number; effectiveWeeklyRate: number } => {
  console.log('[calculateBaseFoodCost] Inputs:', {
    totalNights, // Log received nights
    displayWeeks, // Log received rounded weeks
    foodContribution,
  });

  // Determine BASE weekly food & facilities rate
  let weeklyFoodRate: number;
  const defaultWeeklyRate = 345; // Default weekly rate

  if (foodContribution !== null && foodContribution !== undefined) {
    weeklyFoodRate = foodContribution;
    console.log('[calculateBaseFoodCost] Using food contribution for weekly rate:', { foodContribution, weeklyFoodRate });
  } else {
    weeklyFoodRate = defaultWeeklyRate;
    console.log('[calculateBaseFoodCost] Using default weekly food rate:', weeklyFoodRate);
  }

  // === Use the provided DISPLAY (rounded) weeks for BASE cost calculation ===
  const totalBaseFoodCost = weeklyFoodRate * displayWeeks; // Use passed-in rounded weeks
  console.log('[calculateBaseFoodCost] Results:', { displayWeeks, weeklyFoodRate, totalBaseFoodCost });

  return {
    // totalNights is calculated outside now
    totalBaseFoodCost, // Return the undiscounted cost calculated with rounded weeks
    effectiveWeeklyRate: weeklyFoodRate // Return the base rate used
  };
};

// Helper function to format date ranges
export const formatDateRange = (week: Week): string => {
  return `${format(week.startDate, 'MMM d')} - ${format(week.endDate, 'MMM d')}`;
};

// Helper function to format overall date range
// For a date range like "Jul 1 → Jul 14", this represents 13 nights
// The number of nights is calculated as (end date - start date) in days
export const formatOverallDateRange = (selectedWeeks: Week[]): string => {
  if (selectedWeeks.length === 0) return '';
  
  // Determine the effective start date (could be a selected flex date)
  const firstWeek = selectedWeeks[0];
  const effectiveStartDate = firstWeek.selectedFlexDate || firstWeek.startDate;

  const lastDate = selectedWeeks[selectedWeeks.length - 1].endDate;
  
  // Use formatInTimeZone for consistent UTC display
  return `${formatInTimeZone(effectiveStartDate, 'UTC', 'MMM d')} → ${formatInTimeZone(lastDate, 'UTC', 'MMM d')}`;
};

// Helper function to format date with day of week (Use UTC)
export const formatDateWithDay = (date: Date): string => {
  return formatInTimeZone(date, 'UTC', 'EEEE, MMMM d');
};

// NEW Helper function to format as Month Day (Use UTC)
// const formatMonthDay = (date: Date): string => {
//   return formatInTimeZone(date, 'UTC', 'MMMM d');
// };

// Helper function to add ordinal suffix to day of month (Use UTC)
export const formatDateWithOrdinal = (date: Date): string => {
  // Get UTC date parts
  const day = date.getUTCDate();
  const suffix = ['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10 ? day % 10 : 0)];
  return formatInTimeZone(date, 'UTC', 'EEEE, MMMM') + ' ' + day + suffix;
};

// Helper function to determine the text for what the discount applies to
export const getAppliesToText = (appliesToValue: string | undefined): string => {
  switch (appliesToValue) {
    case 'accommodation':
      return 'Accommodation';
    case 'food_facilities':
      return 'Food & Facilities';
    case 'total':
    default: // Also handles undefined or other unexpected values
      return 'Total Amount';
  }
};

// Helper function to calculate food contribution range with duration discount applied
export const calculateFoodContributionRange = (
  totalNights: number,
  durationDiscountPercent: number = 0
): { min: number; max: number; defaultValue: number } => {
  // Determine base range based on stay length
  const baseMin = totalNights <= 6 ? 345 : 240; // 1 week vs 2+ weeks
  const baseMax = 390; // Always €390
  
  // Apply duration discount to the minimum (lower bound gets discounted)
  const discountedMin = Math.round(baseMin * (1 - durationDiscountPercent));
  
  // Default to middle of the range
  const defaultValue = Math.round((discountedMin + baseMax) / 2);
  
  console.log('[calculateFoodContributionRange] Calculated range:', {
    totalNights,
    durationDiscountPercent: (durationDiscountPercent * 100).toFixed(1) + '%',
    baseMin,
    baseMax,
    discountedMin,
    defaultValue
  });
  
  return {
    min: discountedMin,
    max: baseMax,
    defaultValue
  };
};