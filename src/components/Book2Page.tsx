import React, { useState, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { isSameWeek, addWeeks, isAfter, isBefore, startOfMonth, format, addMonths } from 'date-fns';
import { WeekSelector } from './WeekSelector';
import { CabinSelector } from './CabinSelector';
import { BookingSummary } from './BookingSummary';
import { MaxWeeksModal } from './MaxWeeksModal';
import { CalendarConfig } from './admin/CalendarConfig';
import { generateWeeks, generateSquigglePath, getWeeksInRange } from '../utils/dates';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { useSession } from '../hooks/useSession';
import { motion } from 'framer-motion';
import { convertToUTC1 } from '../utils/timezone';

const WEEKS_TO_SHOW = 16;
const BASE_RATE = 245;
const BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1510798831971-661eb04b3739?q=80&w=2940&auto=format&fit=crop";

export function Book2Page() {
  const { accommodations, loading } = useWeeklyAccommodations();
  const [selectedWeeks, setSelectedWeeks] = useState<Date[]>([]);
  const [selectedAccommodation, setSelectedAccommodation] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(convertToUTC1(new Date('2024-12-16'), 0)));
  const [showMaxWeeksModal, setShowMaxWeeksModal] = useState(false);
  const [showCalendarConfig, setShowCalendarConfig] = useState(false);
  const session = useSession();
  
  const [squigglePaths] = useState(() => 
    Array.from({ length: WEEKS_TO_SHOW }, () => generateSquigglePath())
  );

  const weeks = useMemo(() => 
    generateWeeks(currentMonth, WEEKS_TO_SHOW),
    [currentMonth]
  );

  const isAdmin = session?.user?.email === 'andre@thegarden.pt';

  const isConsecutiveWeek = (nextWeek: Date | undefined) => {
    if (!nextWeek || selectedWeeks.length === 0) return false;
    return selectedWeeks.some(week => 
      isSameWeek(addWeeks(week, 1), nextWeek)
    );
  };

  const isFirstOrLastSelected = (week: Date) => {
    if (selectedWeeks.length === 0) return false;
    return isSameWeek(week, selectedWeeks[0]) || 
           isSameWeek(week, selectedWeeks[selectedWeeks.length - 1]);
  };

  const toggleWeek = async (week: Date) => {
    setSelectedWeeks(prev => {
      const isSelected = prev.some(w => isSameWeek(w, week));
      
      if (isSelected && !isFirstOrLastSelected(week)) {
        return prev;
      }
      
      if (isSelected) {
        return prev.filter(w => !isSameWeek(w, week));
      }
      
      if (prev.length === 0) {
        return [week];
      }

      const earliestDate = prev[0];
      const latestDate = prev[prev.length - 1];

      let newWeeks: Date[];
      if (isBefore(week, earliestDate)) {
        newWeeks = [...getWeeksInRange(weeks, week, latestDate)];
      } else if (isAfter(week, latestDate)) {
        newWeeks = [...getWeeksInRange(weeks, earliestDate, week)];
      } else {
        return prev;
      }

      if (newWeeks.length > 12) {
        setShowMaxWeeksModal(true);
        return prev;
      }

      return newWeeks;
    });
  };

  const getPrevMonthName = () => {
    const prevMonth = addMonths(currentMonth, -1);
    return format(prevMonth, 'MMM');
  };

  const getNextMonthName = () => {
    const nextMonth = addMonths(currentMonth, 1);
    return format(nextMonth, 'MMM');
  };

  return (
    <div 
      className="min-h-screen p-4 md:p-8 tree-pattern"
      style={{
        backgroundImage: `linear-gradient(rgba(244, 240, 232, 0.9), rgba(244, 240, 232, 0.9)), url(${BACKGROUND_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    
      <div className="grid lg:grid-cols-[2fr,1fr] gap-8 max-w-6xl mx-auto">
        <section>
          <div className="flex items-center justify-between mb-8">
            <motion.button
              onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
              className="bg-white px-6 py-2 rounded-lg font-serif text-lg hover:bg-stone-50 transition-colors pixel-corners"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {getPrevMonthName()}
            </motion.button>
            
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-serif font-light">
                {format(currentMonth, `MMMM '''`)}
                {format(currentMonth, 'yy')}
              </h2>
              {isAdmin && (
                <button
                  onClick={() => setShowCalendarConfig(true)}
                  className="p-1 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <Calendar className="w-4 h-4 text-emerald-600" />
                </button>
              )}
            </div>
            
            <motion.button
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
              className="bg-white px-6 py-2 rounded-lg font-serif text-lg hover:bg-stone-50 transition-colors pixel-corners"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {getNextMonthName()}
            </motion.button>
          </div>

          <WeekSelector
            weeks={weeks}
            selectedWeeks={selectedWeeks}
            onToggleWeek={toggleWeek}
            isConsecutiveWeek={isConsecutiveWeek}
            isFirstOrLastSelected={isFirstOrLastSelected}
            currentMonth={currentMonth}
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
          selectedAccommodation={selectedAccommodation}
          baseRate={BASE_RATE}
          onClearWeeks={() => setSelectedWeeks([])}
          onClearAccommodation={() => setSelectedAccommodation(null)}
        />
      </div>

      <MaxWeeksModal 
        isOpen={showMaxWeeksModal}
        onClose={() => setShowMaxWeeksModal(false)}
      />

      {showCalendarConfig && (
        <CalendarConfig
          onClose={() => setShowCalendarConfig(false)}
          onSave={() => {
            setShowCalendarConfig(false);
            setSelectedWeeks([]);
          }}
        />
      )}
    </div>
  );
}