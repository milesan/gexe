import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { isSameWeek, addWeeks, isAfter, isBefore, startOfMonth, format, addMonths, subMonths, startOfDay } from 'date-fns';
import { WeekSelector } from '../components/WeekSelector';
import { formatDateForDisplay } from '../utils/dates';
import { CabinSelector } from '../components/CabinSelector';
import { BookingSummary } from '../components/BookingSummary';
import { MaxWeeksModal } from '../components/MaxWeeksModal';
import { WeekCustomizationModal } from '../components/admin/WeekCustomizationModal';
import { generateWeeksWithCustomizations, generateSquigglePath, getWeeksInRange } from '../utils/dates';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { useSession } from '../hooks/useSession';
import { motion } from 'framer-motion';
import { convertToUTC1 } from '../utils/timezone';
import { useCalendar } from '../hooks/useCalendar';
import { Week, WeekStatus } from '../types/calendar';

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
    isLoading: calendarLoading,
    isAdminMode,
    statusCounts: weeks?.reduce((acc, week) => {
      acc[week.status] = (acc[week.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    firstWeek: weeks?.length > 0 ? {
      startDate: formatDateForDisplay(weeks[0].startDate),
      endDate: formatDateForDisplay(weeks[0].endDate),
      status: weeks[0].status
    } : null,
    lastWeek: weeks?.length > 0 ? {
      startDate: formatDateForDisplay(weeks[weeks.length - 1].startDate),
      endDate: formatDateForDisplay(weeks[weeks.length - 1].endDate),
      status: weeks[weeks.length - 1].status
    } : null,
    deletedWeeks: weeks?.filter(w => w.status === 'deleted').map(w => ({
      id: w.id,
      startDate: formatDateForDisplay(w.startDate),
      endDate: formatDateForDisplay(w.endDate)
    }))
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
    return isSameWeek(week.startDate, selectedWeeks[0].startDate) || 
           isSameWeek(week.startDate, selectedWeeks[selectedWeeks.length - 1].startDate);
  }, [selectedWeeks]);

  const handleSaveWeekCustomization = async (updates: {
    status: WeekStatus;
    name?: string;
    startDate?: Date;
    endDate?: Date;
  }) => {
    console.log('[Book2Page] Saving week customization:', {
      weekStartDate: selectedWeekForCustomization ? formatDateForDisplay(selectedWeekForCustomization.startDate) : null,
      updates: {
        status: updates.status,
        name: updates.name,
        startDate: updates.startDate ? formatDateForDisplay(updates.startDate) : null,
        endDate: updates.endDate ? formatDateForDisplay(updates.endDate) : null
      }
    });

    if (!selectedWeekForCustomization) {
      console.error('[Book2Page] No week selected for customization');
      return;
    }

    // Find any existing customizations for this week
    const matchingCustomizations = customizations?.filter(c => 
      isSameWeek(new Date(c.startDate), selectedWeekForCustomization.startDate)
    ) || [];

    console.log('[Book2Page] Found matching customizations:', {
      count: matchingCustomizations.length,
      customizations: matchingCustomizations.map(c => ({
        id: c.id,
        status: c.status,
        name: c.name,
        startDate: formatDateForDisplay(c.startDate)
      }))
    });

    // If the week already has the requested status and name, no need to update
    if (matchingCustomizations.some(c => 
      c.status === updates.status && 
      c.name === updates.name && 
      Boolean(c.id)
    )) {
      console.log('[Book2Page] Week already has the requested status and name:', {
        status: updates.status,
        name: updates.name
      });
      
      // No need to update - already has the requested status and name
      setLastRefresh(Date.now());
      setSelectedWeekForCustomization(null);
      return;
    }

    // Filter out customizations with undefined IDs
    const validCustomizations = matchingCustomizations.filter(c => Boolean(c.id));

    console.log('[Book2Page] Valid customizations with IDs:', validCustomizations.length);

    try {
      let customizationResult = null;
      
      // If we have existing customizations with valid IDs, use the latest one
      if (validCustomizations.length > 0) {
        // Sort by createdAt to get the most recent one
        const sortedCustomizations = [...validCustomizations].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        // Use the most recent one
        const mostRecent = sortedCustomizations[0];
        
        console.log('[Book2Page] Updating most recent customization with ID:', mostRecent.id, {
          fromStatus: mostRecent.status,
          toStatus: updates.status,
          fromName: mostRecent.name || '(none)',
          toName: updates.name || '(none)'
        });
        
        try {
          customizationResult = await updateCustomization(mostRecent.id, {
            ...updates,
            startDate: updates.startDate || new Date(mostRecent.startDate),
            endDate: updates.endDate || new Date(mostRecent.endDate),
            status: updates.status,
            name: updates.name
          });
        } catch (updateError) {
          console.error('[Book2Page] Error updating customization, will try to create a new one:', updateError);
          
          // If update fails, try to create a new customization
          customizationResult = await createCustomization({
            ...updates,
            startDate: updates.startDate || selectedWeekForCustomization.startDate,
            endDate: updates.endDate || selectedWeekForCustomization.endDate,
            status: updates.status,
            name: updates.name
          });
        }
        
        // Delete any other duplicates if they exist
        if (sortedCustomizations.length > 1) {
          console.log('[Book2Page] Cleaning up duplicate customizations');
          const duplicatesToDelete = sortedCustomizations.slice(1);
          
          for (const duplicate of duplicatesToDelete) {
            console.log('[Book2Page] Deleting duplicate customization with ID:', duplicate.id);
            await deleteCustomization(duplicate.id);
          }
        }
      } else {
        // No valid customizations found, create a new one
        console.log('[Book2Page] Creating new customization for week:', formatDateForDisplay(selectedWeekForCustomization.startDate));
        customizationResult = await createCustomization({
          ...updates,
          startDate: updates.startDate || selectedWeekForCustomization.startDate,
          endDate: updates.endDate || selectedWeekForCustomization.endDate,
          status: updates.status,
          name: updates.name
        });
      }
      
      if (customizationResult) {
        console.log('[Book2Page] Successfully saved customization:', {
          id: customizationResult.id,
          status: customizationResult.status,
          startDate: formatDateForDisplay(customizationResult.startDate)
        });
      } else {
        console.error('[Book2Page] Failed to save customization - no result returned');
      }
      
      // Force a refresh after making changes to ensure UI reflects the changes
      setLastRefresh(Date.now());
      setSelectedWeekForCustomization(null);
    } catch (error) {
      console.error('Failed to save week customization:', error);
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

  return (
    <div 
      className="min-h-screen tree-pattern"
      style={{
        backgroundImage: `linear-gradient(rgba(244, 240, 232, 0.9), rgba(244, 240, 232, 0.9)), url(${BACKGROUND_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Admin Controls */}
      {isAdmin && (
        <div className="mb-6 flex justify-center">
          <button
            onClick={() => setIsAdminMode(!isAdminMode)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-all duration-200
              ${isAdminMode 
                ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200' 
                : 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'}
            `}
          >
            <div className={`
              w-10 h-6 rounded-full p-1 transition-all duration-200
              ${isAdminMode ? 'bg-amber-500' : 'bg-green-500'}
            `}>
              <div className={`
                w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200
                ${isAdminMode ? 'translate-x-4' : 'translate-x-0'}
              `}></div>
            </div>
            <span className="font-medium">
              {isAdminMode ? 'Exit Edit Mode' : 'Edit Weeks'}
            </span>
          </button>
        </div>
      )}

      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8 text-stone-800">Book Your Stay</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Calendar */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-stone-800">Select Your Dates</h2>
                <div className="flex gap-2">
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
                <h2 className="text-xl font-semibold mb-4 text-stone-800">Your Stay</h2>
                {selectedWeeks.length > 0 ? (
                  <BookingSummary 
                    selectedWeeks={selectedWeeks}
                    selectedAccommodation={selectedAccommodation ? 
                      accommodations?.find(a => a.id === selectedAccommodation) : null
                    }
                    baseRate={BASE_RATE}
                    onClearWeeks={() => setSelectedWeeks([])}
                    onClearAccommodation={() => setSelectedAccommodation(null)}
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
        <MaxWeeksModal onClose={() => setShowMaxWeeksModal(false)} />
      )}
      
      {isAdmin && isAdminMode && selectedWeekForCustomization && (
        <WeekCustomizationModal
          week={selectedWeekForCustomization}
          onClose={() => setSelectedWeekForCustomization(null)}
          onSave={handleSaveWeekCustomization}
        />
      )}
    </div>
  );
}