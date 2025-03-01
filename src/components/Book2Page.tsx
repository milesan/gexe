import React, { useState, useMemo, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { isSameWeek, addWeeks, isAfter, isBefore, startOfMonth, format, addMonths } from 'date-fns';
import { WeekSelector } from './WeekSelector';
import { CabinSelector } from './CabinSelector';
import { BookingSummary } from './BookingSummary';
import { MaxWeeksModal } from './MaxWeeksModal';
import { WeekCustomizationModal } from './admin/WeekCustomizationModal';
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
    updateCustomization
  } = useCalendar({
    startDate: currentMonth,
    endDate: addMonths(currentMonth, isMobile ? 3 : 4)
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

      let newWeeks: Week[];
      if (isBefore(week.startDate, earliestDate)) {
        newWeeks = [...getWeeksInRange(weeks, week.startDate, latestDate)];
      } else if (isAfter(week.startDate, latestDate)) {
        newWeeks = [...getWeeksInRange(weeks, earliestDate, week.startDate)];
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
  }) => {
    if (!selectedWeekForCustomization) return;

    const existing = customizations.find(c => 
      isSameWeek(c.startDate, selectedWeekForCustomization.startDate)
    );

    if (existing) {
      await updateCustomization(existing.id, updates);
    } else {
      await createCustomization({
        ...updates,
        startDate: updates.startDate || selectedWeekForCustomization.startDate,
        endDate: updates.endDate || selectedWeekForCustomization.endDate,
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
                  <span>{isAdminMode ? '22 Edit Mode' : 'Edit Weeks'}</span>
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
            onSelectWeek={handleWeekSelect}
            currentMonth={currentMonth}
            isMobile={isMobile}
            isAdmin={isAdminMode}
          />
          
          <CabinSelector
            accommodations={accommodations}
            selectedAccommodation={selectedAccommodation}
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