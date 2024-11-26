import React, { useState, useMemo, useEffect } from 'react';
import { Trees } from 'lucide-react';
import { isSameWeek, addWeeks, isAfter, isBefore, startOfMonth, format, addMonths } from 'date-fns';
import { WeekSelector } from '../components/WeekSelector';
import { CabinSelector } from '../components/CabinSelector';
import { BookingSummary } from '../components/BookingSummary';
import { MaxWeeksModal } from '../components/MaxWeeksModal';
import { WhitelistWelcomeModal } from '../components/WhitelistWelcomeModal';
import { generateWeeks, generateSquigglePath, getWeeksInRange } from '../utils/dates';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { useSession } from '../hooks/useSession';
import { motion } from 'framer-motion';
import { convertToUTC1 } from '../utils/timezone';
import { supabase } from '../lib/supabase';
import { useMediaQuery } from '../hooks/useMediaQuery';

const DESKTOP_WEEKS = 16;
const MOBILE_WEEKS = 12;
const BASE_RATE = 245;
const BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1510798831971-661eb04b3739?q=80&w=2940&auto=format&fit=crop";

export function Book2Page() {
  const { accommodations, loading } = useWeeklyAccommodations();
  const [selectedWeeks, setSelectedWeeks] = useState<Date[]>([]);
  const [selectedAccommodation, setSelectedAccommodation] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(convertToUTC1(new Date('2024-12-16'), 0)));
  const [showMaxWeeksModal, setShowMaxWeeksModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const session = useSession();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [squigglePaths] = useState(() => 
    Array.from({ length: DESKTOP_WEEKS }, () => generateSquigglePath())
  );

  const weeks = useMemo(() => 
    generateWeeks(currentMonth, isMobile ? MOBILE_WEEKS : DESKTOP_WEEKS),
    [currentMonth, isMobile]
  );

  useEffect(() => {
    const checkWhitelistStatus = async () => {
      if (!session?.user) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.user_metadata?.has_seen_welcome && user?.user_metadata?.is_whitelisted) {
        setShowWelcomeModal(true);
        await supabase.auth.updateUser({
          data: { has_seen_welcome: true }
        });
      }
    };

    checkWhitelistStatus();
  }, [session]);

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
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-stone mb-8">
          <h1 className="font-serif text-3xl font-light text-stone-900 mb-4">Welcome to the Garden, wayfarer</h1>
          <p className="text-stone-600 font-body leading-relaxed">
            This is the final boss: the calendar. Choice awaits. Here are a few details to help you along the way...
          </p>
          <ul className="text-stone-600 font-body space-y-3 list-none pl-0">
            <li className="flex items-start gap-2">
              <span className="text-emerald-700">❧</span>
              <span>A minimum stay of two weeks is recommended, and longer stays are generally <a href="https://www.wikiwand.com/en/articles/Self-selection_bias" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-emerald-800">more</a> <a href="https://www.wikiwand.com/en/articles/Survivorship_bias" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-emerald-800">meaningful</a></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-700">❧</span>
              Contributions include stay & lunch & dinner from Monday to Friday
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-700">❧</span>
              All accommodations [except van & campers] include sheets, duvet, pillow, and towel
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-700">❧</span>
              Free & unlimited access to laundry machines, dryers, and detergent
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-700">❧</span>
              You are expected to participate in cleaning up after meals
            </li>
          </ul>
        </div>
      </div>

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
            isMobile={isMobile}
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

      <WhitelistWelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />
    </div>
  );
}