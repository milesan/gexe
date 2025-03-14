import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { isSameWeek, addWeeks, isAfter, isBefore, startOfMonth, format, addMonths, subMonths, startOfDay, isSameDay, addDays, eachDayOfInterval, differenceInDays } from 'date-fns';
import { WeekSelector } from '../components/WeekSelector';
import { formatDateForDisplay, normalizeToUTCDate, doDateRangesOverlap } from '../utils/dates';
import { CabinSelector } from '../components/CabinSelector';
import { BookingSummary, SeasonBreakdown } from '../components/BookingSummary';
import { MaxWeeksModal } from '../components/MaxWeeksModal';
import { WeekCustomizationModal } from '../components/admin/WeekCustomizationModal';
import { generateWeeksWithCustomizations, generateSquigglePath, getWeeksInRange } from '../utils/dates';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { useSession } from '../hooks/useSession';
import { motion } from 'framer-motion';
import { convertToUTC1 } from '../utils/timezone';
import { useCalendar } from '../hooks/useCalendar';
import { Week, WeekStatus } from '../types/calendar';
import { CalendarService } from '../services/CalendarService';
import { CalendarConfigButton } from '../components/admin/CalendarConfigButton';
import { getSeasonalDiscount } from '../utils/pricing';

const DESKTOP_WEEKS = 16;
const MOBILE_WEEKS = 12;
const BASE_RATE = 3;
const BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1510798831971-661eb04b3739?q=80&w=2940&auto=format&fit=crop";

export function Book2Page() {
  // Get current date and set the initial month
  const today = new Date();
  const initialMonth = startOfDay(startOfMonth(today));
  
  console.log('[Book2Page] Initializing with current month:', {
    today: formatDateForDisplay(today),
    initialMonth: formatDateForDisplay(initialMonth)
  });

  const { accommodations, loading: accommodationsLoading } = useWeeklyAccommodations();
  const [selectedWeeks, setSelectedWeeks] = useState<Week[]>([]);
  const [selectedAccommodation, setSelectedAccommodation] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [showMaxWeeksModal, setShowMaxWeeksModal] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedWeekForCustomization, setSelectedWeekForCustomization] = useState<Week | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [seasonBreakdown, setSeasonBreakdown] = useState<SeasonBreakdown | undefined>(undefined);

  const session = useSession();
  const isAdmin = session?.user?.email === 'andre@thegarden.pt' || session?.user?.email === 'redis213@gmail.com';
  const isMobile = window.innerWidth < 768;

  // Calculate end date based on current month and device type
  const calendarEndDate = addMonths(currentMonth, isMobile ? 3 : 4);

  console.log('[Book2Page] Calendar date range:', {
    startDate: formatDateForDisplay(currentMonth),
    endDate: formatDateForDisplay(calendarEndDate),
    monthsDifference: isMobile ? 3 : 4
  });

  // Use our calendar hook
  const { 
    weeks,
    customizations,
    isLoading: calendarLoading,
    createCustomization,
    updateCustomization,
    deleteCustomization,
    setLastRefresh: setCalendarRefresh
  } = useCalendar({
    startDate: currentMonth,
    endDate: calendarEndDate,
    isAdminMode
  });

  // Sync the local refresh state with the useCalendar hook's refresh state
  useEffect(() => {
    setCalendarRefresh(lastRefresh);
  }, [lastRefresh, setCalendarRefresh]);

  console.log('[Book2Page] Calendar state:', {
    weeksCount: weeks?.length,
    customizationsCount: customizations?.length,
    isLoading: calendarLoading
  });

  // Handle week selection
  const handleWeekSelect = useCallback((week: Week) => {
    console.log('[Book2Page] Week selected:', {
      weekStartDate: formatDateForDisplay(week.startDate),
      weekEndDate: formatDateForDisplay(week.endDate),
      isAdminMode,
      currentSelectedWeeks: selectedWeeks.length
    });

    if (isAdminMode) {
      setSelectedWeekForCustomization(week);
      return;
    }

    setSelectedWeeks(prev => {
      const isSelected = prev.some(w => w.startDate.toISOString() === week.startDate.toISOString());
      
      if (isSelected && !isFirstOrLastSelected(week)) {
        return prev;
      }
      
      if (isSelected) {
        return prev.filter(w => w.startDate.toISOString() !== week.startDate.toISOString());
      }
      
      if (prev.length === 0) {
        return [week];
      }

      const earliestDate = prev[0].startDate;
      const latestDate = prev[prev.length - 1].startDate;

      let newWeeks: Week[];
      if (isBefore(week.startDate, earliestDate)) {
        newWeeks = weeks.filter(w => 
          w.startDate >= week.startDate && w.startDate <= latestDate
        );
      } else if (isAfter(week.startDate, latestDate)) {
        newWeeks = weeks.filter(w => 
          w.startDate >= earliestDate && w.startDate <= week.startDate
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
  }, [isAdminMode, weeks, selectedWeeks]);

  // Helper functions
  const isFirstOrLastSelected = useCallback((week: Week) => {
    if (selectedWeeks.length === 0) return false;
    return week.startDate.toISOString() === selectedWeeks[0].startDate.toISOString() || 
           week.startDate.toISOString() === selectedWeeks[selectedWeeks.length - 1].startDate.toISOString();
  }, [selectedWeeks]);

  /**
   * Handle saving week customization changes
   * 
   * This function is called when a user saves changes in the WeekCustomizationModal.
   * It delegates the actual update/create logic to the CalendarService, which handles
   * all the complex overlap resolution.
   */
  const handleSaveWeekCustomization = async (updates: {
    status: WeekStatus;
    name?: string;
    startDate?: Date;
    endDate?: Date;
    flexibleDates?: Date[];
  }) => {
    if (!selectedWeekForCustomization) return;

    try {
      // Normalize all dates for consistent handling
      const finalStartDate = normalizeToUTCDate(updates.startDate || selectedWeekForCustomization.startDate);
      const finalEndDate = normalizeToUTCDate(updates.endDate || selectedWeekForCustomization.endDate);
      const flexibleDates = updates.flexibleDates?.map(d => normalizeToUTCDate(d));

      console.log('[Book2Page] Saving week customization:', {
        weekId: selectedWeekForCustomization.id,
        startDate: formatDateForDisplay(finalStartDate),
        endDate: formatDateForDisplay(finalEndDate),
        status: updates.status,
        flexibleDatesCount: flexibleDates?.length || 0
      });

      // Check if this is an existing customization or a new one
      if (selectedWeekForCustomization.isCustom && selectedWeekForCustomization.id) {
        // Update existing customization
        await CalendarService.updateCustomization(selectedWeekForCustomization.id, {
          ...updates,
          startDate: finalStartDate,
          endDate: finalEndDate,
          flexibleDates
        });
      } else {
        // Create new customization
        await CalendarService.createCustomization({
                startDate: finalStartDate,
                endDate: finalEndDate,
                status: updates.status,
                name: updates.name,
          flexibleDates
        });
      }
      
      // Refresh calendar data and close modal
        setLastRefresh(Date.now());
        setSelectedWeekForCustomization(null);
    } catch (error) {
      console.error('[Book2Page] Error saving week customization:', error);
      // Show error to user (you could add a toast notification here)
    }
  };

  /**
   * Handle deleting a week customization (resetting to default)
   * 
   * This function is called when a user clicks the "Reset to Default" button in the WeekCustomizationModal.
   * It deletes the customization from the database, which effectively resets the week to its default state.
   */
  const handleDeleteWeekCustomization = async (weekId: string) => {
    try {
      console.log('[Book2Page] Deleting week customization:', { weekId });
      
      // Delete the customization
      const success = await CalendarService.deleteCustomization(weekId);
      
      if (success) {
        console.log('[Book2Page] Successfully deleted week customization');
      } else {
        console.error('[Book2Page] Failed to delete week customization');
      }
      
      // Refresh calendar data and close modal
      setLastRefresh(Date.now());
      setSelectedWeekForCustomization(null);
    } catch (error) {
      console.error('[Book2Page] Error deleting week customization:', error);
    }
  };

  useEffect(() => {
    if (!isAdmin && selectedWeeks.length > 0) {
      const today = startOfDay(new Date());
      const filteredWeeks = selectedWeeks.filter(week => {
        const weekStartDate = startOfDay(new Date(week.startDate));
        return weekStartDate >= today;
      });
      
      if (filteredWeeks.length !== selectedWeeks.length) {
        console.log('[Book2Page] Removing past weeks from selection', {
          originalCount: selectedWeeks.length,
          newCount: filteredWeeks.length
        });
        setSelectedWeeks(filteredWeeks);
      }
    }
  }, [selectedWeeks, isAdmin]);

  const isLoading = accommodationsLoading || calendarLoading;

  // Calculate season breakdown for the selected weeks
  const calculateSeasonBreakdown = useCallback((weeks: Week[]): SeasonBreakdown => {
    if (weeks.length === 0) {
      const discount = getSeasonalDiscount(currentMonth);
      const seasonName = discount === 0 ? 'High Season' : 
                         discount === 0.15 ? 'Shoulder Season' : 
                         'Winter Season';
      return { 
        hasMultipleSeasons: false, 
        seasons: [{ name: seasonName, discount, nights: 0 }] 
      };
    }

    // Sort the weeks to ensure we're processing dates in chronological order
    const sortedWeeks = [...weeks].sort((a, b) => 
      a.startDate.getTime() - b.startDate.getTime()
    );
    
    // Get the overall stay period
    const startDate = sortedWeeks[0].startDate;
    const endDate = sortedWeeks[sortedWeeks.length - 1].endDate;
    
    // Calculate total nights - simple end date minus start date
    const totalNights = differenceInDays(endDate, startDate);
    
    // Group nights by season
    const seasonMap: Record<string, { name: string; discount: number; nights: number }> = {};
    
    // Get all dates in the stay (excluding checkout day)
    const allDates = eachDayOfInterval({
      start: startDate,
      end: addDays(endDate, -1) // Exclude checkout day
    });
    
    // Count the nights per season using the date of each night
    allDates.forEach(date => {
      const discount = getSeasonalDiscount(date);
      const seasonName = discount === 0 ? 'High Season' : 
                         discount === 0.15 ? 'Shoulder Season' : 
                         'Winter Season';
      const key = `${seasonName}-${discount}`;
      
      if (!seasonMap[key]) {
        seasonMap[key] = { name: seasonName, discount, nights: 0 };
      }
      
      seasonMap[key].nights++;
    });
    
    // Validate our calculations
    const totalCalculatedNights = Object.values(seasonMap).reduce(
      (sum, season) => sum + season.nights, 0
    );
    
    if (totalCalculatedNights !== totalNights) {
      console.warn(`[Book2Page] Night calculation mismatch: ${totalCalculatedNights} vs expected ${totalNights}`);
    }
    
    const seasons = Object.values(seasonMap).sort((a, b) => b.nights - a.nights);
    const hasMultipleSeasons = seasons.length > 1;
    
    console.log('[Book2Page] Season breakdown:', { 
      hasMultipleSeasons, 
      seasons,
      totalNights,
      dateRange: `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd')}`,
      allDates: allDates.map(d => format(d, 'MMM dd')),
    });
    
    return { hasMultipleSeasons, seasons };
  }, [currentMonth]);

  // Update season breakdown when selected weeks change
  useEffect(() => {
    if (selectedWeeks.length > 0) {
      const breakdown = calculateSeasonBreakdown(selectedWeeks);
      setSeasonBreakdown(breakdown);
    } else {
      setSeasonBreakdown(undefined);
    }
  }, [selectedWeeks, calculateSeasonBreakdown]);

  return (
    <div 
      className="min-h-screen tree-pattern"
      style={{
        backgroundImage: `linear-gradient(rgba(244, 240, 232, 0.9), rgba(244, 240, 232, 0.9)), url(${BACKGROUND_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8 text-stone-800">Book Your Stay</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Calendar */}
          <div className="md:col-span-2">
            {/* Move admin controls here - above the calendar white box */}
            {isAdmin && (
              <div className="flex justify-end mb-4">
                {isAdminMode ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsAdminMode(false)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-amber-600 text-white hover:bg-amber-700 transition-all duration-200 font-medium"
                    >
                      <svg 
                        className="h-5 w-5" 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12"></path>
                      </svg>
                      <span>Exit Edit Mode</span>
                    </button>
                    
                    <CalendarConfigButton 
                      onConfigChanged={() => {
                        // Refresh data when config changes
                        setLastRefresh(Date.now());
                      }} 
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAdminMode(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-all duration-200 font-medium"
                  >
                    <svg 
                      className="h-5 w-5" 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <span>Edit Mode</span>
                  </button>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-stone-800">Select Your Dates</h2>
                <div className="flex gap-2">
                  {/* Only navigation buttons now */}
                  <button 
                    className="p-2 rounded-full hover:bg-gray-100"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="h-5 w-5 text-stone-600" />
                  </button>
                  <button 
                    className="p-2 rounded-full hover:bg-gray-100"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-5 w-5 text-stone-600" />
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="flex items-center text-sm text-stone-600">
                  <Calendar className="w-4 h-4 mr-1" />
                  <span>{format(currentMonth, 'MMMM yyyy')}</span>
                </div>
              </div>
              
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-800"></div>
                </div>
              ) : (
                <WeekSelector 
                  weeks={weeks}
                  selectedWeeks={selectedWeeks}
                  onWeekSelect={handleWeekSelect}
                  isAdmin={isAdminMode}
                />
              )}
            </div>
            
            {/* Cabin Selector - Now under the calendar */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-stone-800">Select Accommodation</h2>
              <CabinSelector 
                accommodations={accommodations || []}
                selectedAccommodationId={selectedAccommodation}
                onSelectAccommodation={setSelectedAccommodation}
                selectedWeeks={selectedWeeks}
                currentMonth={currentMonth}
                isLoading={accommodationsLoading}
                isDisabled={selectedWeeks.length === 0}
              />
              {selectedWeeks.length === 0 && (
                <p className="text-sm text-stone-500 mt-2 italic">Please select dates above to enable accommodation selection</p>
              )}
            </div>
          </div>

          {/* Right Column - Booking Summary */}
          <div>
            <div className="sticky top-8">
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                {selectedWeeks.length > 0 ? (
                  <BookingSummary 
                    selectedWeeks={selectedWeeks}
                    selectedAccommodation={selectedAccommodation && accommodations ? 
                      accommodations.find(a => a.id === selectedAccommodation) || null : null
                    }
                    baseRate={BASE_RATE}
                    onClearWeeks={() => setSelectedWeeks([])}
                    onClearAccommodation={() => setSelectedAccommodation(null)}
                    seasonBreakdown={seasonBreakdown}
                  />
                ) : (
                  <div className="text-stone-600 text-sm">
                    <p>Select your dates to see booking details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showMaxWeeksModal && (
        <MaxWeeksModal 
          isOpen={showMaxWeeksModal} 
          onClose={() => setShowMaxWeeksModal(false)} 
        />
      )}
      
      {isAdmin && isAdminMode && selectedWeekForCustomization && (
        <WeekCustomizationModal
          week={selectedWeekForCustomization}
          onClose={() => setSelectedWeekForCustomization(null)}
          onSave={handleSaveWeekCustomization}
          onDelete={handleDeleteWeekCustomization}
        />
      )}
    </div>
  );
}