import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { getDurationDiscount, getSeasonalDiscount, getSeasonBreakdown } from '../utils/pricing';
import { calculateDurationDiscountWeeks } from '../utils/dates';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkInDate: Date;
  checkOutDate: Date;
  accommodationName: string;
  basePrice: number;
}

// Custom hook to handle all discount calculations
function useDiscounts(checkInDate: Date, checkOutDate: Date, accommodationName: string, basePrice: number) {
  // Calculate duration discount using the utility function
  const completeWeeks = calculateDurationDiscountWeeks([{ 
    startDate: checkInDate, 
    endDate: checkOutDate,
    status: 'visible' as const
  }]);
  const durationDiscount = getDurationDiscount(completeWeeks);

  // Calculate seasonal discount
  const seasonBreakdown = getSeasonBreakdown(checkInDate, checkOutDate);
  const showSeasonalSection = basePrice > 0 && seasonBreakdown.seasons.length > 0 && !accommodationName.toLowerCase().includes('dorm');

  // Calculate weighted average seasonal discount
  const totalNights = seasonBreakdown.seasons.reduce((sum, season) => sum + season.nights, 0);
  const averageSeasonalDiscount = seasonBreakdown.seasons.reduce((sum, season) => 
    sum + (season.discount * season.nights), 0) / totalNights;

  // Calculate combined discount
  const combinedDiscount = basePrice > 0 
    ? 1 - (1 - averageSeasonalDiscount) * (1 - durationDiscount)
    : durationDiscount;

  return {
    completeWeeks,
    durationDiscount,
    seasonBreakdown,
    showSeasonalSection,
    combinedDiscount,
    averageSeasonalDiscount
  };
}

export function DiscountModal({ 
  isOpen, 
  onClose, 
  checkInDate,
  checkOutDate,
  accommodationName,
  basePrice
}: DiscountModalProps) {
  const {
    completeWeeks,
    durationDiscount,
    seasonBreakdown,
    showSeasonalSection,
    combinedDiscount,
    averageSeasonalDiscount
  } = useDiscounts(checkInDate, checkOutDate, accommodationName, basePrice);

  return (
    <>
      {isOpen && createPortal(
        <AnimatePresence>
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
              className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full mx-2 sm:mx-4 relative z-[101] max-h-[85vh] overflow-y-auto"
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
                {showSeasonalSection && (
                  <div className="border-l-2 border-emerald-200 pl-3 sm:pl-4 py-2">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-stone-800 text-xs sm:text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Seasonal Discount
                      </h4>
                      <span className="text-emerald-700 font-medium text-xs sm:text-sm">
                        {Math.round(averageSeasonalDiscount * 100)}%
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-stone-600">
                      Based on your selected dates, you get a seasonal discount on accommodation:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {seasonBreakdown.seasons.map((season, index) => (
                          <li key={index} className={season.nights > 0 ? "text-emerald-700 font-medium" : ""}>
                            {season.name}: {season.discount === 0 ? "Standard rate" : `${Math.round(season.discount * 100)}% off`}
                            {season.nights > 0 && ` (${season.nights} night${season.nights !== 1 ? 's' : ''})`}
                          </li>
                        ))}
                      </ul>
                    </p>
                  </div>
                )}
                
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
                
                <div className="flex justify-between items-center border-t border-stone-200 pt-3 sm:pt-4">
                  <span className="text-stone-600 text-xs sm:text-sm font-medium">Total discount applied</span>
                  <span className="text-emerald-700 font-medium text-sm sm:text-base">
                    {Math.round(combinedDiscount * 100)}%
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}