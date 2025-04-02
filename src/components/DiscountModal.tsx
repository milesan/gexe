import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowDown } from 'lucide-react';
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

  // Calculate seasonal discount breakdown for accommodation
  const seasonBreakdown = getSeasonBreakdown(checkInDate, checkOutDate);
  const showAccSeasonalSection = basePrice > 0 && seasonBreakdown.seasons.length > 0 && !accommodationName.toLowerCase().includes('dorm');

  // Calculate weighted average seasonal discount for accommodation (only if applicable)
  let averageAccSeasonalDiscount = 0;
  if (showAccSeasonalSection) {
     const totalNightsInSeasons = seasonBreakdown.seasons.reduce((sum, season) => sum + season.nights, 0);
     if (totalNightsInSeasons > 0) {
         averageAccSeasonalDiscount = seasonBreakdown.seasons.reduce((sum, season) => 
            sum + (season.discount * season.nights), 0) / totalNightsInSeasons;
     } else {
        averageAccSeasonalDiscount = 0;
        console.warn("[DiscountModal] Calculated zero nights in seasons for seasonal discount calculation.");
     }
  }

  // Calculate the final accommodation weekly price (rounded)
  const finalAccWeeklyPrice = basePrice > 0
    ? Math.round(basePrice * (1 - averageAccSeasonalDiscount) * (1 - durationDiscount))
    : 0; 

  console.log('[DiscountModal] useDiscounts Results:', {
    basePrice,
    completeWeeks,
    durationDiscount,
    showAccSeasonalSection,
    averageAccSeasonalDiscount,
    finalAccWeeklyPrice,
    seasonBreakdown
  });

  return {
    completeWeeks,
    durationDiscount,
    seasonBreakdown,
    showAccSeasonalSection,
    averageAccSeasonalDiscount,
    finalAccWeeklyPrice
  };
}

export function DiscountModal({ 
  isOpen, 
  onClose, 
  checkInDate,
  checkOutDate,
  accommodationName,
  basePrice // Base price for accommodation
}: DiscountModalProps) {
  const {
    completeWeeks,
    durationDiscount,
    seasonBreakdown,
    showAccSeasonalSection, // Renamed for clarity
    averageAccSeasonalDiscount, // Renamed for clarity
    finalAccWeeklyPrice // Renamed for clarity
  } = useDiscounts(checkInDate, checkOutDate, accommodationName, basePrice);

  // Helper to format percentage
  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
  
  // Determine if only the duration discount applies (no seasonal or accommodation is free)
  const onlyDurationDiscount = durationDiscount > 0 && !showAccSeasonalSection;
  const noAccommodationDiscount = basePrice === 0;

  return (
    <>
      {isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-800/95 rounded-lg p-4 sm:p-6 max-w-md w-full relative z-[101] max-h-[90vh] overflow-y-auto shadow-xl border border-gray-500/30 text-white backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute top-2 sm:top-4 right-2 sm:right-4 text-gray-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base sm:text-lg font-display text-white mb-4 sm:mb-6">
                 Discount Details
              </h3>
              
              <div className="space-y-4 sm:space-y-5">

                 {/* === Accommodation Section (Conditional) === */}  
                 {!noAccommodationDiscount && (
                     <>              
                         {/* Base Rate Section */}
                         <div className="text-center border border-gray-600/50 rounded-md p-3">
                            <div className="text-xs text-gray-400 font-regular mb-1">Accommodation Base Weekly Rate</div>
                            <div className="text-lg font-medium text-white font-regular">€{Math.round(basePrice)}</div>
                         </div>
                         
                         <div className="flex justify-center">
                            <ArrowDown className="w-5 h-5 text-gray-500"/>
                         </div>

                        {/* Combined Accommodation Discounts Section */}
                        <div className="border border-gray-600/50 rounded-md p-3 space-y-3">
                          {showAccSeasonalSection && (
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="font-regular text-white text-xs sm:text-sm flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-accent-primary"></span>
                                  Seasonal Discount (Accomm.)
                                </h4>
                                <span className="text-accent-primary font-regular text-xs sm:text-sm font-medium">
                                  -{formatPercent(averageAccSeasonalDiscount)}
                                </span>
                              </div>
                              <p className="text-[10px] sm:text-xs text-gray-300 font-regular pl-4">
                                (Weighted average based on your dates: 
                                {seasonBreakdown.seasons.map((s, i) => 
                                  ` ${s.nights} night${s.nights !== 1 ? 's' : ''} in ${s.name}${i < seasonBreakdown.seasons.length - 1 ? ',' : ''}`
                                )})
                              </p>
                            </div>
                          )}
                          
                          {durationDiscount > 0 && (
                             <div>
                                <div className="flex justify-between items-center mb-1">
                                  <h4 className="text-white text-xs sm:text-sm flex items-center gap-2 font-regular">
                                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                    Duration Discount (Accomm.)
                                  </h4>
                                  <span className="text-purple-400 text-xs sm:text-sm font-regular font-medium">
                                    -{formatPercent(durationDiscount)}
                                  </span>
                                </div>
                            </div>
                          )}
                           {/* Show message if no discounts applied *to accommodation* */}
                           {!showAccSeasonalSection && durationDiscount === 0 && (
                              <p className="text-xs text-gray-400 font-regular text-center italic">No discounts applicable to accommodation.</p>
                           )}
                        </div>

                         <div className="flex justify-center">
                            <ArrowDown className="w-5 h-5 text-gray-500"/>
                         </div>

                        {/* Final Accommodation Rate Section */}
                        <div className="text-center border border-accent-primary/60 rounded-md p-3 bg-accent-primary/10">
                            <div className="text-xs text-accent-primary/80 font-regular mb-1">Final Accommodation Weekly Rate</div>
                            <div className="text-lg font-medium text-accent-primary font-regular">€{finalAccWeeklyPrice}</div>
                            <p className="text-[10px] sm:text-xs text-gray-400 mt-2">Base Rate × (1 - Seasonal) × (1 - Duration)</p>
                         </div>

                         {/* Separator if duration discount also applies to F&F */}    
                         {durationDiscount > 0 && <div className="border-t border-dashed border-gray-600 my-4"></div>}
                    </>
                )} 

                {/* === Duration Discount for Food & Facilities (Always show if applicable) === */}  
                 {durationDiscount > 0 && (
                   <div className="border border-gray-600/50 rounded-md p-3 space-y-2">
                      <div className="flex justify-between items-center mb-1">
                          <h4 className="text-white text-xs sm:text-sm flex items-center gap-2 font-regular">
                            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                            Duration Discount (Food & Facilities)
                          </h4>
                          <span className="text-purple-400 text-xs sm:text-sm font-regular font-medium">
                            -{formatPercent(durationDiscount)}
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-300 font-regular pl-4">
                            (Applied for stays of 3+ weeks. You're staying {completeWeeks} week{completeWeeks !== 1 ? 's' : ''}.)
                        </p>
                   </div>
                 )}

                 {/* Message if accommodation is free */}
                 {noAccommodationDiscount && durationDiscount === 0 && (
                    <p className="text-xs text-gray-400 font-regular text-center italic">Accommodation is free. No duration discount applicable (requires 3+ weeks).</p>
                 )} 
                 {noAccommodationDiscount && durationDiscount > 0 && (
                    <p className="text-xs text-gray-400 font-regular text-center italic">Accommodation is free. Duration discount applies to Food & Facilities cost.</p>
                 )} 
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}