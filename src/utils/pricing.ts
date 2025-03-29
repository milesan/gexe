import { addWeeks, startOfWeek, addDays, addMonths, eachDayOfInterval, isBefore, differenceInDays } from 'date-fns';
import { convertToUTC1 } from './timezone';
import { Week } from '../types/calendar';
import { calculateTotalNights, calculateTotalDays } from './dates';

export function getSeasonalDiscount(date: Date, accommodationType?: string): number {
  // Dorm rooms don't get seasonal discounts
  if (accommodationType?.toLowerCase().includes('dorm')) return 0;

  const month = date.getMonth();
  const year = date.getFullYear();
  
  // Low Season (November-May) - 40% discount for non-dorm rooms
  if (month <= 4 || month >= 10) return 0.40;
  
  // Medium Season (June, October) - 15% discount
  if (month === 5 || month === 9) return 0.15;
  
  // Summer Season (July, August, September) - No discount
  return 0;
}

export function getSeasonName(date: Date): string {
  const discount = getSeasonalDiscount(date);
  return discount === 0 ? 'Summer Season' : 
         discount === 0.15 ? 'Medium Season' : 
         'Low Season';
}

export function getDurationDiscount(numberOfWeeks: number): number {
  // Round down to nearest whole week
  const completeWeeks = Math.floor(numberOfWeeks);
  
  if (completeWeeks < 3) return 0;
  
  // Base discount for 3 weeks
  const baseDiscount = 0.10; // 10%
  
  // Additional discount for each week 3 and above
  if (completeWeeks >= 3) {
    const extraWeeks = completeWeeks - 3;
    const extraDiscount = (extraWeeks * 0.0278); // 2.78% per additional week
    
    // Cap at 35% (reached at 12 weeks)
    return Math.min(baseDiscount + extraDiscount, 0.35);
  }
  
  return baseDiscount;
}

export function getSeasonBreakdown(checkIn: Date, checkOut: Date): { hasMultipleSeasons: boolean, seasons: { name: string, discount: number, nights: number }[] } {
  // Initialize with all possible seasons
  const seasonMap: Record<string, { name: string, discount: number, nights: number }> = {
    'Low Season-0.4': { name: 'Low Season', discount: 0.4, nights: 0 },
    'Medium Season-0.15': { name: 'Medium Season', discount: 0.15, nights: 0 },
    'Summer Season-0': { name: 'Summer Season', discount: 0, nights: 0 }
  };

  if (isBefore(checkOut, checkIn)) {
    return { 
      hasMultipleSeasons: false, 
      seasons: Object.values(seasonMap)
    };
  }

  const totalNights = differenceInDays(checkOut, checkIn);
  
  if (totalNights === 0) {
    return { 
      hasMultipleSeasons: false, 
      seasons: Object.values(seasonMap)
    };
  }
  
  // Get all nights in the selected period
  const allNights = eachDayOfInterval({ 
    start: checkIn, 
    end: checkOut 
  }).slice(0, -1); // Remove the last day since we want nights
  
  // Count nights per season
  allNights.forEach(night => {
    const discount = getSeasonalDiscount(night);
    const seasonName = getSeasonName(night);
    const key = `${seasonName}-${discount}`;
    
    if (seasonMap[key]) {
      seasonMap[key].nights++;
    }
  });
  
  // Always return seasons in the order: Low, Medium, Summer
  const seasons = Object.values(seasonMap);
  const hasMultipleSeasons = seasons.some(s => s.nights > 0) && seasons.filter(s => s.nights > 0).length > 1;
  
  console.log('[pricing] Season breakdown:', { 
    hasMultipleSeasons, 
    seasons,
    totalNights,
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString()
  });
  
  return { hasMultipleSeasons, seasons };
}