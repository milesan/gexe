import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Week } from '../types/calendar';
import { getSeasonalDiscount, getDurationDiscount } from '../utils/pricing';
import { eachDayOfInterval, isBefore } from 'date-fns';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWeeks: Week[];
}

export function DiscountModal({ isOpen, onClose, selectedWeeks }: DiscountModalProps) {
  // Calculate weighted seasonal discount
  const calculateWeightedSeasonalDiscount = (weeks: Week[]): number => {
    if (weeks.length === 0) return 0;

    // Get all days in the selected period
    let allDays: Date[] = [];
    
    weeks.forEach(week => {
      const startDate = week.startDate;
      const endDate = week.endDate;
      
      if (endDate < startDate) {
        console.warn('[DiscountModal] Invalid date range:', { startDate, endDate });
        return;
      }
      
      // Get all days in this week
      const daysInWeek = Array.from({ length: (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1 }, (_, i) => new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000));
      allDays = [...allDays, ...daysInWeek];
    });
    
    if (allDays.length === 0) return 0;
    
    // Calculate discount for each day
    let totalDiscount = 0;
    
    allDays.forEach(day => {
      totalDiscount += getSeasonalDiscount(day);
    });
    
    // Calculate weighted average discount
    const weightedDiscount = totalDiscount / allDays.length;
    
    console.log('[DiscountModal] Weighted seasonal discount calculation:', {
      totalDays: allDays.length,
      firstDay: allDays[0]?.toISOString(),
      lastDay: allDays[allDays.length - 1]?.toISOString(),
      weightedDiscount: weightedDiscount,
      discountPercentage: `${(weightedDiscount * 100).toFixed(1)}%`
    });
    
    return weightedDiscount;
  };

  // Calculate duration discount
  const calculateDurationDiscount = (weeks: Week[]): number => {
    if (weeks.length === 0) return 0;
    
    // Calculate total nights (inclusive of start and end dates)
    const totalDays = weeks.reduce((acc, week) => {
      return acc + (week.endDate.getTime() - week.startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
    }, 0);
    
    // Convert to complete weeks (rounding down)
    const completeWeeks = Math.floor(totalDays / 7);
    
    console.log('[DiscountModal] Duration discount calculation:', {
      totalDays,
      completeWeeks,
      durationDiscount: getDurationDiscount(completeWeeks)
    });
    
    return getDurationDiscount(completeWeeks);
  };

  // Determine if the booking spans multiple seasons
  const getSeasonBreakdown = (weeks: Week[]): { hasMultipleSeasons: boolean, seasons: { name: string, discount: number, days: number }[] } => {
    if (weeks.length === 0) {
      const discount = getSeasonalDiscount(new Date());
      const seasonName = discount === 0 ? 'High Season' : 
                         discount === 0.15 ? 'Shoulder Season' : 
                         'Winter Season';
      return { 
        hasMultipleSeasons: false, 
        seasons: [{ name: seasonName, discount, days: 0 }] 
      };
    }

    // Get all days in the selected period
    let allDays: Date[] = [];
    
    weeks.forEach(week => {
      const startDate = week.startDate;
      const endDate = week.endDate;
      
      if (isBefore(endDate, startDate)) {
        return;
      }
      
      const daysInWeek = eachDayOfInterval({ start: startDate, end: endDate });
      allDays = [...allDays, ...daysInWeek];
    });
    
    if (allDays.length === 0) {
      const discount = getSeasonalDiscount(new Date());
      const seasonName = discount === 0 ? 'High Season' : 
                         discount === 0.15 ? 'Shoulder Season' : 
                         'Winter Season';
      return { 
        hasMultipleSeasons: false, 
        seasons: [{ name: seasonName, discount, days: 0 }] 
      };
    }
    
    // Group days by season
    const seasonMap: Record<string, { name: string, discount: number, days: number }> = {};
    
    allDays.forEach(day => {
      const discount = getSeasonalDiscount(day);
      const seasonName = discount === 0 ? 'High Season' : 
                         discount === 0.15 ? 'Shoulder Season' : 
                         'Winter Season';
      const key = `${seasonName}-${discount}`;
      
      if (!seasonMap[key]) {
        seasonMap[key] = { name: seasonName, discount, days: 0 };
      }
      
      seasonMap[key].days++;
    });
    
    const seasons = Object.values(seasonMap).sort((a, b) => b.days - a.days);
    const hasMultipleSeasons = seasons.length > 1;
    
    console.log('[DiscountModal] Season breakdown:', { 
      hasMultipleSeasons, 
      seasons,
      totalDays: allDays.length
    });
    
    return { hasMultipleSeasons, seasons };
  };

  const seasonalDiscount = calculateWeightedSeasonalDiscount(selectedWeeks);
  const durationDiscount = calculateDurationDiscount(selectedWeeks);
  const { hasMultipleSeasons, seasons } = getSeasonBreakdown(selectedWeeks);
  
  // Calculate combined discount (multiplicative)
  const combinedDiscount = 1 - (1 - seasonalDiscount) * (1 - durationDiscount);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full mx-2 sm:mx-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-2 sm:top-4 right-2 sm:right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base sm:text-lg font-semibold text-stone-800 mb-4 sm:mb-6">
              Discount Breakdown
            </h3>
            
            <div className="space-y-6 sm:space-y-8">
              {/* Seasonal Discount */}
              {seasonalDiscount > 0 && (
                <div className="border-l-2 border-emerald-200 pl-3 sm:pl-4 py-2">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-stone-800 text-xs sm:text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      Seasonal Discount
                    </h4>
                    <span className="text-emerald-700 font-medium text-xs sm:text-sm">
                      {hasMultipleSeasons ? `~${Math.round(seasonalDiscount * 100)}% off` : `${(seasonalDiscount * 100).toFixed(2)}% off`}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-stone-600">
                    {hasMultipleSeasons ? (
                      <>
                        <p className="mb-2">The actual discount is calculated per night based on the season:</p>
                        <div className="mt-2 space-y-2">
                          {seasons.map((season, index) => (
                            <div key={index} className="flex items-center text-xs gap-2">
                              <span className="min-w-[100px]">{season.name}</span>
                              <span className="font-medium">{season.days} nights × {Math.round(season.discount * 100)}% off</span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2">The number shown above (~{Math.round(seasonalDiscount * 100)}%) is just an indicative average - each night gets its own specific discount.</p>
                        <p className="mt-2 text-stone-600 italic">Note: Seasonal discounts apply to all accommodation prices, except dorm rooms.</p>
                      </>
                    ) : (
                      <>
                        Based on your selected dates, you get a seasonal discount on accommodation:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Winter (Nov-May): 40% off</li>
                          <li>Shoulder (Jun, Oct): 15% off</li>
                          <li>High (Jul-Sep): Standard rate</li>
                        </ul>
                        <p className="mt-2 text-stone-600 italic">Note: Seasonal discounts apply to all accommodation prices, except dorm rooms.</p>
                      </>
                    )}
                  </p>
                </div>
              )}
              
              {/* Duration Discount - Always show */}
              <div className="border-l-2 border-violet-200 pl-3 sm:pl-4 py-2">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-stone-800 text-xs sm:text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                    Duration Discount
                  </h4>
                  <span className="text-violet-700 font-medium text-xs sm:text-sm">
                    {durationDiscount > 0 ? `${(durationDiscount * 100).toFixed(2)}% off` : 'No discount'}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-stone-600">
                  Stay 3 weeks or longer to get our duration discount:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>3+ weeks: 10% off everything</li>
                    <li>Additional weeks: +2.78% off per week</li>
                    <li>Maximum discount: 35% (at 12 weeks)</li>
                  </ul>
                  <p className="mt-2">  
                    Currently staying {selectedWeeks.length} week{selectedWeeks.length !== 1 ? 's' : ''}.
                  </p>
                </p>
              </div>
              
              {/* Total Savings */}
              <div className="flex justify-between items-center border-t border-stone-200 pt-3 sm:pt-4">
                <span className="text-stone-600 text-xs sm:text-sm font-medium">Total discount applied</span>
                <span className="text-emerald-700 font-medium text-sm sm:text-base">
                  {hasMultipleSeasons ? '~' : ''}{(combinedDiscount * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}