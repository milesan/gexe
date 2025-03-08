import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, Settings } from 'lucide-react';
import { isSameWeek, addWeeks, isAfter, isBefore, startOfMonth, format, addMonths, isSameDay } from 'date-fns';
import { WeekSelector } from './WeekSelector';
import { CabinSelector } from './CabinSelector';
import { BookingSummary } from './BookingSummary';
import { MaxWeeksModal } from './MaxWeeksModal';
import { WeekCustomizationModal } from './admin/WeekCustomizationModal';
import { generateWeeksWithCustomizations, generateSquigglePath } from '../utils/dates';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { useSession } from '../hooks/useSession';
import { motion } from 'framer-motion';
import { convertToUTC1 } from '../utils/timezone';
import { normalizeToUTCDate } from '../utils/dates';
import { useCalendar } from '../hooks/useCalendar';
import { Week, WeekStatus } from '../types/calendar';
import { CalendarService } from '../services/CalendarService';
import { formatDateForDisplay } from '../utils/dates';

const DESKTOP_WEEKS = 16;
const MOBILE_WEEKS = 12;
const BASE_RATE = 3;
const BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1510798831971-661eb04b3739?q=80&w=2940&auto=format&fit=crop";

export function Book2Page() {
  const { accommodations, loading: accommodationsLoading } = useWeeklyAccommodations();
  
  const [selectedWeeks, setSelectedWeeks] = useState<Week[]>([]);
  const [selectedAccommodation, setSelectedAccommodation] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(convertToUTC1(new Date('2024-12-16'), 0)));
  const [showMaxWeeksModal, setShowMaxWeeksModal] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedWeekForCustomization, setSelectedWeekForCustomization] = useState<Week | null>(null);

  const session = useSession();
  const isAdmin = session?.user?.email === 'andre@thegarden.pt' || session?.user?.email === 'redis213@gmail.com';
  const isMobile = window.innerWidth < 768;

  // Use our calendar hook
  const { 
    weeks,
    customizations,
    isLoading: calendarLoading,
    createCustomization,
    updateCustomization,
    setLastRefresh
  } = useCalendar({
    startDate: currentMonth,
    endDate: addMonths(currentMonth, isMobile ? 3 : 4),
    isAdminMode: isAdminMode
  });

  const handleWeekSelect = useCallback((week: Week) => {
    if (isAdminMode) {
      setSelectedWeekForCustomization(week);
      return;
    }

    setSelectedWeeks(prev => {
      const isSelected = prev.some(w => isSameWeek(w.startDate, week.startDate));
      
      if (isSelected && !isFirstOrLastSelected(week)) {
        return prev;
      }
      
      if (isSelected) {
        return prev.filter(w => !isSameWeek(w.startDate, week.startDate));
      }
      
      if (prev.length === 0) {
        return [week];
      }

      const earliestDate = prev[0].startDate;
      const latestDate = prev[prev.length - 1].startDate;

      // Filter weeks that are in the desired range
      let newWeeks: Week[];
      if (isBefore(week.startDate, earliestDate)) {
        // Get weeks between the new week and the latest selected week
        newWeeks = weeks.filter(w => 
          (isSameDay(w.startDate, week.startDate) || isAfter(w.startDate, week.startDate)) && 
          (isBefore(w.startDate, latestDate) || isSameDay(w.startDate, latestDate))
        );
      } else if (isAfter(week.startDate, latestDate)) {
        // Get weeks between the earliest selected week and the new week
        newWeeks = weeks.filter(w => 
          (isSameDay(w.startDate, earliestDate) || isAfter(w.startDate, earliestDate)) && 
          (isBefore(w.startDate, week.startDate) || isSameDay(w.startDate, week.startDate))
        );
      } else {
        return prev;
      }

      if (newWeeks.length > 12) {
        setShowMaxWeeksModal(true);
        return prev;
      }

      return newWeeks;
    });
  }, [isAdminMode, weeks]);

  const handleSaveWeekCustomization = async (updates: {
    status: WeekStatus;
    name?: string;
    startDate?: Date;
    endDate?: Date;
    flexibleDates?: Date[];
  }) => {
    if (!selectedWeekForCustomization) return;

    // Get the final start and end dates after updates
    const finalStartDate = updates.startDate || selectedWeekForCustomization.startDate;
    const finalEndDate = updates.endDate || selectedWeekForCustomization.endDate;

    // Check for overlapping customizations
    console.log('[Book2Page] Checking for overlapping customizations with new dates:', {
      startDate: updates.startDate ? formatDateForDisplay(updates.startDate) : 'unchanged',
      endDate: updates.endDate ? formatDateForDisplay(updates.endDate) : 'unchanged'
    });

    // Find existing customization for this week
    const existing = customizations.find(c => {
        // Normalize dates for comparison
        const cStart = normalizeToUTCDate(c.startDate);
        const cEnd = normalizeToUTCDate(c.endDate);
        const weekStart = normalizeToUTCDate(selectedWeekForCustomization.startDate);
        const weekEnd = normalizeToUTCDate(selectedWeekForCustomization.endDate);
        
        // Use isSameDay for proper date comparison
        return isSameDay(cStart, weekStart) && isSameDay(cEnd, weekEnd);
    });

    // If we're changing dates, we need to check for overlaps
    if (updates.startDate || updates.endDate) {
      const startDate = finalStartDate;
      const endDate = finalEndDate;
      
      // Find any customizations that overlap with the new date range
      const overlappingCustomizations = customizations.filter(c => {
        if (existing && c.id === existing.id) return false; // Skip the current customization
        
        // Normalize dates for comparison
        const cStart = normalizeToUTCDate(c.startDate);
        const cEnd = normalizeToUTCDate(c.endDate);
        const newStart = normalizeToUTCDate(startDate);
        const newEnd = normalizeToUTCDate(endDate);
        
        // Check for any kind of overlap between date ranges
        const hasOverlap = (
          // Case 1: New range starts during existing range
          (cStart <= newStart && newStart <= cEnd) ||
          // Case 2: New range ends during existing range
          (cStart <= newEnd && newEnd <= cEnd) ||
          // Case 3: New range completely contains existing range
          (newStart <= cStart && cEnd <= newEnd) ||
          // Case 4: Existing range completely contains new range
          (cStart <= newStart && newEnd <= cEnd)
        );
        
        console.log('[Book2Page] Checking for overlap:', {
          customization: { 
            start: formatDateForDisplay(cStart), 
            end: formatDateForDisplay(cEnd),
            id: c.id
          },
          newRange: { 
            start: formatDateForDisplay(newStart), 
            end: formatDateForDisplay(newEnd)
          },
          hasOverlap
        });
        
        return hasOverlap;
      });
      
      console.log('[Book2Page] Found overlapping customizations:', {
        count: overlappingCustomizations.length,
        overlaps: overlappingCustomizations.map(c => ({
          id: c.id,
          startDate: formatDateForDisplay(c.startDate),
          endDate: formatDateForDisplay(c.endDate)
        }))
      });
      
      // Use processWeekOperations to handle overlaps properly
      if (overlappingCustomizations.length > 0) {
        const operations: Array<{
          type: 'create' | 'update' | 'delete';
          week: {
            id?: string;
            startDate?: Date;
            endDate?: Date;
            status?: string;
            name?: string | null;
            flexibleDates?: Date[];
          }
        }> = [];
        
        // Add update/create operation for current week
        operations.push({
          type: existing ? 'update' as const : 'create' as const,
          week: {
            id: existing?.id,
            startDate,
            endDate,
            status: updates.status,
            name: updates.name,
            flexibleDates: updates.flexibleDates
          }
        });
        
        // Add operations to handle overlapping weeks
        for (const overlap of overlappingCustomizations) {
          const overlapStart = normalizeToUTCDate(overlap.startDate);
          const overlapEnd = normalizeToUTCDate(overlap.endDate);
          const newStart = normalizeToUTCDate(startDate);
          const newEnd = normalizeToUTCDate(endDate);
          
          // If the overlap is completely contained, delete it
          if (newStart <= overlapStart && overlapEnd <= newEnd) {
            operations.push({
              type: 'delete' as const,
              week: { id: overlap.id }
            });
          } 
          // If the overlap extends before our new start date, adjust it to end before our start
          else if (overlapStart < newStart && overlapEnd >= newStart && overlapEnd <= newEnd) {
            const newEndDate = new Date(newStart);
            newEndDate.setDate(newEndDate.getDate() - 1);
            
            // Also handle flexible dates that might be in the overlap
            const flexibleDates = overlap.flexibleDates?.filter(date => 
              normalizeToUTCDate(date) < newStart
            );
            
            operations.push({
              type: 'update' as const,
              week: {
                id: overlap.id,
                endDate: newEndDate,
                status: overlap.status,
                name: overlap.name,
                flexibleDates
              }
            });
          }
          // If the overlap extends after our new end date, adjust it to start after our end
          else if (overlapStart >= newStart && overlapStart <= newEnd && overlapEnd > newEnd) {
            const newStartDate = new Date(newEnd);
            newStartDate.setDate(newStartDate.getDate() + 1);
            
            // Also handle flexible dates that might be in the overlap
            const flexibleDates = overlap.flexibleDates?.filter(date => 
              normalizeToUTCDate(date) > newEnd
            );
            
            operations.push({
              type: 'update' as const,
              week: {
                id: overlap.id,
                startDate: newStartDate,
                status: overlap.status,
                name: overlap.name,
                flexibleDates
              }
            });
          }
          // If the new range is completely contained within the overlap, split it into two
          else if (overlapStart < newStart && overlapEnd > newEnd) {
            // First part: from overlap start to before new start
            const firstEndDate = new Date(newStart);
            firstEndDate.setDate(firstEndDate.getDate() - 1);
            
            // Second part: from after new end to overlap end
            const secondStartDate = new Date(newEnd);
            secondStartDate.setDate(secondStartDate.getDate() + 1);
            
            // Filter flexible dates for each part
            const firstFlexDates = overlap.flexibleDates?.filter(date => 
              normalizeToUTCDate(date) < newStart
            );
            
            const secondFlexDates = overlap.flexibleDates?.filter(date => 
              normalizeToUTCDate(date) > newEnd
            );
            
            // Update the existing week to be the first part
            operations.push({
              type: 'update' as const,
              week: {
                id: overlap.id,
                endDate: firstEndDate,
                status: overlap.status,
                name: overlap.name,
                flexibleDates: firstFlexDates
              }
            });
            
            // Create a new week for the second part
            operations.push({
              type: 'create' as const,
              week: {
                startDate: secondStartDate,
                endDate: overlap.endDate,
                status: overlap.status,
                name: overlap.name,
                flexibleDates: secondFlexDates
              }
            });
          }
        }
        
        console.log('[Book2Page] Processing week operations to handle overlaps:', operations);
        await CalendarService.processWeekOperations(operations);
        
        // Refresh calendar data
        setLastRefresh(Date.now());
        return;
      }
    }

    // If no overlaps or no date changes, proceed with normal update/create
    if (existing) {
        await updateCustomization(existing.id, updates);
    } else {
        await createCustomization({
            ...updates,
            startDate: finalStartDate,
            endDate: finalEndDate,
            status: updates.status
        });
    }
  };

  const isFirstOrLastSelected = (week: Week) => {
    if (selectedWeeks.length === 0) return false;
    return isSameWeek(week.startDate, selectedWeeks[0].startDate) || 
           isSameWeek(week.startDate, selectedWeeks[selectedWeeks.length - 1].startDate);
  };

  const isLoading = accommodationsLoading || calendarLoading;

  return (
    <div 
      className="min-h-screen p-4 md:p-8 tree-pattern"
      style={{
        backgroundImage: `linear-gradient(rgba(244, 240, 232, 0.9), rgba(244, 240, 232, 0.9)), url(${BACKGROUND_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="grid lg:grid-cols-[2fr,1fr] gap-8 max-w-6xl mx-auto">
        <section>
          <div className="flex items-center justify-between mb-8">
            <motion.button
              onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
              className="bg-white px-6 py-2 rounded-lg font-serif text-lg hover:bg-stone-50 transition-colors pixel-corners"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {format(addMonths(currentMonth, -1), 'MMM')}
            </motion.button>
            
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-serif font-light">
                {format(currentMonth, `MMMM '''`)}
                {format(currentMonth, 'yy')}
              </h2>
              {isAdmin && (
                <button
                  onClick={() => setIsAdminMode(!isAdminMode)}
                  className="flex items-center gap-2 bg-emerald-900 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>{isAdminMode ? 'Exit Edit Mode' : 'Edit Weeks'}</span>
                </button>
              )}
            </div>
            
            <motion.button
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
              className="bg-white px-6 py-2 rounded-lg font-serif text-lg hover:bg-stone-50 transition-colors pixel-corners"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {format(addMonths(currentMonth, 1), 'MMM')}
            </motion.button>
          </div>

          <WeekSelector
            weeks={weeks}
            selectedWeeks={selectedWeeks}
            onWeekSelect={handleWeekSelect}
            currentMonth={currentMonth}
            isMobile={isMobile}
            isAdmin={isAdminMode}
          />
          
          <CabinSelector
            accommodations={accommodations}
            selectedAccommodationId={selectedAccommodation}
            onSelectAccommodation={setSelectedAccommodation}
            selectedWeeks={selectedWeeks}
            currentMonth={currentMonth}
          />
        </section>

        <BookingSummary
          selectedWeeks={selectedWeeks}
          selectedAccommodation={selectedAccommodation ? 
            accommodations.find(a => a.id === selectedAccommodation) : null}
          baseRate={BASE_RATE}
          onClearWeeks={() => setSelectedWeeks([])}
          onClearAccommodation={() => setSelectedAccommodation(null)}
        />
      </div>

      <MaxWeeksModal 
        isOpen={showMaxWeeksModal}
        onClose={() => setShowMaxWeeksModal(false)}
      />

      <WeekCustomizationModal
        isOpen={!!selectedWeekForCustomization}
        week={selectedWeekForCustomization!}
        onClose={() => setSelectedWeekForCustomization(null)}
        onSave={handleSaveWeekCustomization}
      />
    </div>
  );
}