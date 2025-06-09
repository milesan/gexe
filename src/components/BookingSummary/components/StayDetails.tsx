import React from 'react';
import { motion } from 'framer-motion';
import type { Week } from '../../../types/calendar';
import { formatDateWithDay, formatNumber } from '../BookingSummary.utils';
import { calculateTotalWeeksDecimal } from '../../../utils/dates';

interface StayDetailsProps {
  selectedWeeks: Week[];
}

export function StayDetails({ selectedWeeks }: StayDetailsProps) {
  // --- Calculate display weeks using utility function ---
  // --- Use DECIMAL weeks for display --- 
  const totalWeeksDisplay = calculateTotalWeeksDecimal(selectedWeeks);
  console.log('[BookingSummary] Calculated display weeks (decimal):', { totalWeeksDecimal: totalWeeksDisplay });
  // --- END Calculation ---

  return (
    <motion.div 
      className="relative mb-4" /* Reduced margin */
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Middle div handles border, padding, visuals - REMOVED PADDING */}
      <div className="relative shadow-sm overflow-hidden bg-transparent">
        {/* Inner Blur Layer */}
        <div className="absolute inset-0 -z-10 backdrop-blur-sm bg-surface/50 rounded-sm"></div>

        {/* Content Wrapper (maybe add relative z-10 if needed) */}
        <div className="relative z-10 space-y-3 sm:space-y-4">
          {/* Arrival Information - REMOVED PADDING */}
          <div className="rounded-sm shadow-sm bg-surface p-4"> 
            <h4 className="uppercase font-lettra-bold text-shade-2 text-xs mb-2">
              Arrive By
            </h4>
            <div className="space-y-1">
              <p className="uppercase text-2xl text-primary font-display">{formatDateWithDay(selectedWeeks[0].startDate)}</p>
              <p className="font-lettra text-shade-1 text-sm">2PM-5PM</p> 
            </div>
          </div>
          
          {/* Departure Information - REMOVED PADDING */}
          <div className="rounded-sm shadow-sm bg-surface p-4">
            <h4 className="uppercase font-lettra-bold text-shade-2 text-xs mb-2">
              Leave by
            </h4>
            <div className="space-y-1">
              <p className="uppercase text-2xl text-primary font-display">{formatDateWithDay(selectedWeeks[selectedWeeks.length - 1].endDate)}</p>
              <p className="font-lettra text-shade-1 text-sm">11AM</p>
            </div>
          </div>
          
          {/* Duration - REMOVED PADDING */}
          <div className="rounded-sm shadow-sm bg-surface p-4"> 
            <div className="flex justify-between items-center">
              <div className="w-full">
                <span className="text-primary uppercase font-display text-2xl">
                  {formatNumber(totalWeeksDisplay)} {totalWeeksDisplay === 1 ? 'week' : 'weeks'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}