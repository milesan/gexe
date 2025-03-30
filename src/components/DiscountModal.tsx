import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Week } from '../types/calendar';
import { getSeasonalDiscount, getDurationDiscount, getSeasonBreakdown } from '../utils/pricing';
import { eachDayOfInterval, isBefore } from 'date-fns';
import { calculateTotalNights, calculateDurationDiscountWeeks } from '../utils/dates';

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
      
      if (isBefore(endDate, startDate)) {
        console.warn('[DiscountModal] Invalid date range:', { startDate, endDate });
        return;
      }
      
      // Get all days in this week
      const daysInWeek = eachDayOfInterval({ start: startDate, end: endDate });
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

  const seasonalDiscount = calculateWeightedSeasonalDiscount(selectedWeeks);
  const durationDiscount = getDurationDiscount(calculateDurationDiscountWeeks(selectedWeeks));
  const { hasMultipleSeasons, seasons } = getSeasonBreakdown(
    selectedWeeks[0]?.startDate || new Date(),
    selectedWeeks[selectedWeeks.length - 1]?.endDate || new Date()
  );
  
  // Calculate combined discount (multiplicative)
  const combinedDiscount = 1 - (1 - seasonalDiscount) * (1 - durationDiscount);

  // Calculate complete weeks for highlighting applicable discounts
  const completeWeeks = calculateDurationDiscountWeeks(selectedWeeks);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full mx-2 sm:mx-4 relative z-[101]"
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
                      {hasMultipleSeasons ? `~${Math.round(seasonalDiscount * 100)}%` : `${Math.round(seasonalDiscount * 100)}%`}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-stone-600">
                    {hasMultipleSeasons ? (
                      <>
                        <p className="mb-2">The quieter time of year, the less € you contribute on lodging. Calculated per night based on the season:</p>
                        <div className="mt-2 space-y-2">
                          {seasons
                            .filter(season => season.nights > 0 && season.discount > 0)
                            .map((season, index) => (
                            <div key={index} className={`flex items-center text-xs gap-2 ${season.nights > 0 ? "text-emerald-700 font-medium" : ""}`}>
                              <span className="min-w-[100px]">{season.name}</span>
                              <span className="font-medium">
                                {season.nights} nights × {Math.round(season.discount * 100)}% off
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-stone-600 italic">Note: Seasonal discounts don't apply to dorm rooms.</p>
                      </>
                    ) : (
                      <>
                        Based on your selected dates, you get a seasonal discount on accommodation:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          {seasons.map((season, index) => (
                            <li key={index} className={season.nights > 0 ? "text-emerald-700 font-medium" : ""}>
                              {season.name} ({season.nights > 0 ? "selected" : "not selected"}): {season.discount === 0 ? "Standard rate" : `${Math.round(season.discount * 100)}% off`}
                            </li>
                          ))}
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
                    {durationDiscount > 0 ? `${(durationDiscount * 100).toFixed(2).replace('.00', '')}%` : 'No discount'}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-stone-600">
                  Stay 3 weeks or longer to get our duration discount:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li className={completeWeeks >= 3 ? "text-emerald-700 font-medium" : ""}>3+ weeks: 10% off everything</li>
                    <li className={completeWeeks > 3 ? "text-emerald-700 font-medium" : ""}>Additional weeks: +2.78% off per week</li>
                    <li className={completeWeeks >= 12 ? "text-emerald-700 font-medium" : ""}>Maximum discount: 35% (at 12 weeks)</li>
                  </ul>
                  <p className="mt-2">  
                    Currently staying {completeWeeks === 0 ? "<1" : completeWeeks} week{completeWeeks !== 1 ? 's' : ''}.
                  </p>
                </p>
              </div>
              
              {/* Total Savings */}
              <div className="flex justify-between items-center border-t border-stone-200 pt-3 sm:pt-4">
                <span className="text-stone-600 text-xs sm:text-sm font-medium">Total discount applied</span>
                <span className="text-emerald-700 font-medium text-sm sm:text-base">
                  {hasMultipleSeasons ? '~' : ''}{Math.round(combinedDiscount * 100)}%
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}