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
import { CalendarService } from '../services/CalendarService';

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
  const [showCalendarConfigModal, setShowCalendarConfigModal] = useState(false);
  const [checkInDay, setCheckInDay] = useState<number>(0);
  const [checkOutDay, setCheckOutDay] = useState<number>(6);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

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
      },
      existingCustomizations: customizations?.filter(c => 
        c.startDate.toISOString().split('T')[0] === selectedWeekForCustomization.startDate.toISOString().split('T')[0] &&
        c.endDate.toISOString().split('T')[0] === selectedWeekForCustomization.endDate.toISOString().split('T')[0]
      )
    });

    if (!selectedWeekForCustomization) {
      console.error('[Book2Page] No week selected for customization');
      return;
    }

    // Ensure we have valid dates
    const startDate = updates.startDate || selectedWeekForCustomization.startDate;
    const endDate = updates.endDate || selectedWeekForCustomization.endDate;

    // Find any existing customizations for this week - use EXACT date matching
    const matchingCustomizations = customizations?.filter(c => 
      c.startDate.toISOString().split('T')[0] === selectedWeekForCustomization.startDate.toISOString().split('T')[0] &&
      c.endDate.toISOString().split('T')[0] === selectedWeekForCustomization.endDate.toISOString().split('T')[0]
    ) || [];

    try {
      let customizationResult = null;
      
      if (matchingCustomizations.length > 0) {
        const mostRecent = matchingCustomizations[0];
        
        try {
          customizationResult = await updateCustomization(mostRecent.id, {
            startDate,
            endDate,
            status: updates.status,
            name: updates.name
          });
        } catch (updateError) {
          console.error('[Book2Page] Error updating customization:', updateError);
          
          customizationResult = await createCustomization({
            startDate,
            endDate,
            status: updates.status,
            name: updates.name
          });
        }
      } else {
        customizationResult = await createCustomization({
          startDate,
          endDate,
          status: updates.status,
          name: updates.name
        });
      }
      
      setLastRefresh(Date.now());
      setSelectedWeekForCustomization(null);
      
    } catch (error) {
      console.error('[Book2Page] Failed to save week customization:', error);
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

  // Add this effect to load config when modal opens
  useEffect(() => {
    if (showCalendarConfigModal) {
      const loadConfig = async () => {
        try {
          setConfigLoading(true);
          setConfigError(null);
          
          // Make sure we're using the correct method name and handling potential null responses
          const config = await CalendarService.getConfig();
          
          if (config) {
            console.log('Loaded config:', config);
            setCheckInDay(config.checkInDay || 0);
            setCheckOutDay(config.checkOutDay || 6);
          } else {
            console.log('No config found, using defaults');
            setCheckInDay(0); // Default to Sunday
            setCheckOutDay(6); // Default to Saturday
          }
        } catch (err) {
          console.error('Error loading calendar config:', err);
          setConfigError('Failed to load calendar configuration. Using defaults.');
          
          // Set defaults even on error
          setCheckInDay(0);
          setCheckOutDay(6);
        } finally {
          setConfigLoading(false);
        }
      };
      loadConfig();
    }
  }, [showCalendarConfigModal]);

  // Add this handler for saving config
  const handleSaveConfig = async () => {
    try {
      setConfigSaving(true);
      setConfigError(null);
      setConfigSuccess(null);
      
      await CalendarService.updateConfig({
        checkInDay,
        checkOutDay
      });
      
      setConfigSuccess('Calendar configuration saved successfully');
      setLastRefresh(Date.now());
      
      // Close modal after a delay
      setTimeout(() => {
        setShowCalendarConfigModal(false);
      }, 1500);
    } catch (err) {
      setConfigError('Failed to save calendar configuration');
    } finally {
      setConfigSaving(false);
    }
  };

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
                    
                    <button
                      onClick={() => setShowCalendarConfigModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span>Calendar Settings</span>
                    </button>
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
                <h2 className="text-xl font-semibold mb-4 text-stone-800">Your Stay</h2>
                {selectedWeeks.length > 0 ? (
                  <BookingSummary 
                    selectedWeeks={selectedWeeks}
                    selectedAccommodation={selectedAccommodation && accommodations ? 
                      accommodations.find(a => a.id === selectedAccommodation) || null : null
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
        />
      )}

      {/* Add this modal at the end of your component before the closing tags */}
      {showCalendarConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Calendar Settings</h2>
              <button onClick={() => setShowCalendarConfigModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {configLoading ? (
              <div className="py-8 text-center text-gray-500">Loading settings...</div>
            ) : (
              <>
                {configError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-md">
                    {configError}
                  </div>
                )}
                
                {configSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-700 rounded-md">
                    {configSuccess}
                  </div>
                )}
                
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-4">
                    Set the default check-in and check-out days for your property. These settings affect how weeks are displayed and booked throughout the calendar.
                  </p>
                  
                  <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Check-in Day
                      </label>
                      <select
                        value={checkInDay}
                        onChange={(e) => setCheckInDay(Number(e.target.value))}
                        className="w-full p-2 border rounded bg-white"
                        disabled={configSaving}
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Check-out Day
                      </label>
                      <select
                        value={checkOutDay}
                        onChange={(e) => setCheckOutDay(Number(e.target.value))}
                        className="w-full p-2 border rounded bg-white"
                        disabled={configSaving}
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    </div>
                  </div>
                  
                  {checkInDay === checkOutDay && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-md text-sm">
                      <div className="flex items-start">
                        <svg className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>Check-in and check-out on the same day may cause scheduling conflicts. Consider setting different days.</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCalendarConfigModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                    disabled={configSaving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={configSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    {configSaving ? 'Saving...' : (
                      <>
                        <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                          <polyline points="17 21 17 13 7 13 7 21"></polyline>
                          <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        Save Settings
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}