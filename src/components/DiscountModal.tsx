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
  calculatedWeeklyPrice: number | null;
  averageSeasonalDiscount: number | null;
  // Optional props for extensions where duration should be calculated differently
  durationCheckInDate?: Date;
  durationCheckOutDate?: Date;
}

// Custom hook to handle all discount calculations
function useDiscounts(checkInDate: Date, checkOutDate: Date, accommodationName: string, basePrice: number, durationCheckInDate?: Date, durationCheckOutDate?: Date) {
  // Calculate duration discount using the utility function
  // Use durationCheckInDate/durationCheckOutDate if provided (for extensions), otherwise use regular dates
  const durationStartDate = durationCheckInDate || checkInDate;
  const durationEndDate = durationCheckOutDate || checkOutDate;
  
  const completeWeeks = calculateDurationDiscountWeeks([{ 
    startDate: durationStartDate, 
    endDate: durationEndDate,
    status: 'visible' as const
  }]);
  const durationDiscount = getDurationDiscount(completeWeeks);

  // Calculate seasonal discount breakdown for accommodation
  const seasonBreakdown = getSeasonBreakdown(checkInDate, checkOutDate);
  const showAccSeasonalSection = basePrice > 0 && seasonBreakdown.seasons.length > 0 && !accommodationName.toLowerCase().includes('dorm');

  console.log('[DiscountModal] useDiscounts Results:', {
    basePrice,
    completeWeeks,
    durationDiscount,
    showAccSeasonalSection,
    seasonBreakdown,
    usingCustomDurationDates: !!(durationCheckInDate && durationCheckOutDate),
    seasonalDates: `${checkInDate.toISOString().split('T')[0]} to ${checkOutDate.toISOString().split('T')[0]}`,
    durationDates: `${durationStartDate.toISOString().split('T')[0]} to ${durationEndDate.toISOString().split('T')[0]}`
  });

  return {
    completeWeeks,
    durationDiscount,
    seasonBreakdown,
    showAccSeasonalSection,
  };
}

export function DiscountModal({ 
  isOpen, 
  onClose, 
  checkInDate,
  checkOutDate,
  accommodationName,
  basePrice, // Base price for accommodation
  calculatedWeeklyPrice, // ADDED: Destructure the new prop
  averageSeasonalDiscount, // ADDED: Destructure the new prop
  durationCheckInDate, // Optional: for extensions where duration calculation differs
  durationCheckOutDate // Optional: for extensions where duration calculation differs
}: DiscountModalProps) {
  const {
    completeWeeks,
    durationDiscount,
    seasonBreakdown,
    showAccSeasonalSection, // Renamed for clarity
  } = useDiscounts(checkInDate, checkOutDate, accommodationName, basePrice, durationCheckInDate, durationCheckOutDate);

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
              className="bg-[var(--color-bg-surface)] rounded-sm p-4 sm:p-6 max-w-md w-full relative z-[101] max-h-[90vh] overflow-y-auto shadow-xl border border-gray-500/30 color-text-primary backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute top-2 sm:top-4 right-2 sm:right-4 color-shade-2 hover:color-text-primary"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base sm:text-lg font-display color-text-primary mb-4 sm:mb-6">
                 Discount Details
              </h3>
              
              <div className="space-y-4 sm:space-y-5">

                 {/* === Accommodation Section (Conditional) === */}  
                 {!noAccommodationDiscount && (
                     <>              
                         {/* Base Rate Section */}
                         <div className="text-center border border-gray-600/50 rounded-sm p-3">
                            <div className="text-xs color-shade-3 font-mono mb-1">Accommodation Weekly Rate</div>
                            <div className="text-lg font-medium color-text-primary font-mono">€{Math.round(basePrice)}</div>
                         </div>
                         
                         <div className="flex justify-center">
                            <ArrowDown className="w-5 h-5 color-shade-2"/>
                         </div>

                        {/* Seasonal Discount Section (if applicable) */}
                        {showAccSeasonalSection && averageSeasonalDiscount !== null && averageSeasonalDiscount > 0 && (
                          <div className="border border-gray-600/50 rounded-sm p-3">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="font-mono color-text-primary text-xs sm:text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-accent-primary"></span>
                                Seasonal Discount (Accomm.)
                              </h4>
                              <span className="text-accent-primary font-mono text-xs sm:text-sm font-medium">
                                -{formatPercent(averageSeasonalDiscount)}
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-xs color-shade-2 font-mono pl-4">
                              (Weighted average based on your dates: 
                              {seasonBreakdown.seasons.map((s, i) => 
                                ` ${s.nights} night${s.nights !== 1 ? 's' : ''} in ${s.name}${i < seasonBreakdown.seasons.length - 1 ? ',' : ''}`
                              )})
                            </p>
                          </div>
                        )}

                        {/* Duration Discount Section (if applicable) */}
                        {durationDiscount > 0 && (
                          <>
                            <div className="border border-gray-600/50 rounded-sm p-3">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="color-text-primary text-xs sm:text-sm flex items-center gap-2 font-mono">
                                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                  Duration Discount 
                                </h4>
                                <span className="text-purple-400 text-xs sm:text-sm font-mono font-medium">
                                  -{formatPercent(durationDiscount)}
                                </span>
                              </div>
                              <p className="text-[10px] sm:text-xs color-shade-2 font-mono pl-4">
                                (Applied for stays of 3+ weeks. {durationCheckInDate && durationCheckOutDate ? 'Your total stay is' : 'You\'re staying'} {completeWeeks} week{completeWeeks !== 1 ? 's' : ''}.)
                                {' '}
                                Applies to Food & Facilities{ !noAccommodationDiscount && ' and Accommodation'}.
                              </p>
                            </div>
                            
                            <div className="flex justify-center">
                              <ArrowDown className="w-5 h-5 color-shade-2"/>
                            </div>
                          </>
                        )}

                        {/* Show message if no discounts applied to accommodation */}
                        {!showAccSeasonalSection && durationDiscount === 0 && (
                          <div className="border border-gray-600/50 rounded-sm p-3">
                            <p className="text-xs color-shade-3 font-mono text-center italic">No discounts applicable to accommodation.</p>
                          </div>
                        )}

                        {/* Final Accommodation Rate Section */}
                        <div className="text-center border border-accent-primary/60 rounded-sm p-3 bg-accent-primary/10">
                            <div className="text-xs text-accent-primary/80 font-mono mb-1">Final Accommodation Weekly Rate</div>
                            <div className="text-lg font-medium text-accent-primary font-mono">€{calculatedWeeklyPrice ?? 'N/A'}</div>
                         </div>
                    </>
                )} 

                {/* === Duration Discount for Food & Facilities (Only show if accommodation is free) === */}  
                 {noAccommodationDiscount && durationDiscount > 0 && (
                   <div className="border border-gray-600/50 rounded-sm p-3 space-y-2">
                      <div className="flex justify-between items-center mb-1">
                          <h4 className="color-text-primary text-xs sm:text-sm flex items-center gap-2 font-mono">
                            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                            Duration Discount 
                          </h4>
                          <span className="text-purple-400 text-xs sm:text-sm font-mono font-medium">
                            -{formatPercent(durationDiscount)}
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-xs color-shade-2 font-mono pl-4">
                            (Applied for stays of 3+ weeks. {durationCheckInDate && durationCheckOutDate ? 'Your total stay is' : 'You\'re staying'} {completeWeeks} week{completeWeeks !== 1 ? 's' : ''}.)
                            {' '}
                            Applies to Food & Facilities cost.
                        </p>
                   </div>
                 )}

                 {/* Message if accommodation is free and no duration discount */}
                 {noAccommodationDiscount && durationDiscount === 0 && (
                    <p className="text-xs color-shade-3 font-mono text-center italic">Accommodation is free. No duration discount applicable (requires 3+ weeks).</p>
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
