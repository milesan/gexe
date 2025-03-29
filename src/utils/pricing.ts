import { addWeeks, startOfWeek, addDays, addMonths } from 'date-fns';
import { convertToUTC1 } from './timezone';

export function getSeasonalDiscount(date: Date, accommodationType?: string): number {
  // Dorm rooms don't get seasonal discounts
  if (accommodationType?.toLowerCase().includes('dorm')) return 0;

  const month = date.getMonth();
  const year = date.getFullYear();
  
  // Winter Season (November-May) - 40% discount for non-dorm rooms
  if (month <= 4 || month >= 10) return 0.40;
  
  // Shoulder Season (June, October) - 15% discount
  if (month === 5 || month === 9) return 0.15;
  
  // High Season (July, August, September) - No discount
  return 0;
}

export function getSeasonName(date: Date): string {
  const discount = getSeasonalDiscount(date);
  return discount === 0 ? 'High Season' : 
         discount === 0.15 ? 'Shoulder Season' : 
         'Winter Season';
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