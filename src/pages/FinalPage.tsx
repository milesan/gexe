/* Dead code */

import React, { useState } from 'react';
import { Trees } from 'lucide-react';
import { motion } from 'framer-motion';
import { WeekSelector } from '../components/WeekSelector';
import CabinSelector from '../components/CabinSelector';
import { BookingSummary } from '../components/BookingSummary';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { Week, WeekStatus } from '../types/calendar';
import { addDays } from 'date-fns';

const WEEKS_TO_SHOW = 16;
const BACKGROUND_IMAGE = "https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/background-image//fern-background.jpg"

export function FinalPage() {
  const { accommodations, loading } = useWeeklyAccommodations();
  const [selectedWeeks, setSelectedWeeks] = useState<Week[]>([]);
  const [selectedAccommodation, setSelectedAccommodation] = useState<string | null>(null);

  const handleWeekSelect = (week: Week) => {
    setSelectedWeeks(prev => {
      if (prev.length === 0) {
        return [week];
      }
      return [];
    });
  };

  const handleDateSelect = (date: Date, week: Week) => {
    // Handle flexible date selection
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
      <header className="max-w-6xl mx-auto mb-12">
        <div className="flex items-center gap-3 mb-2">
          <Trees className="w-6 h-6 text-emerald-600" />
          <h1 className="text-2xl font-mono">the Garden</h1>
        </div>
        <p className="text-stone-600 font-mono">Escape to reality</p>
      </header>

      <div className="grid lg:grid-cols-[2fr,1fr] gap-8 max-w-6xl mx-auto">
        <section>
          <WeekSelector
            weeks={[]}
            selectedWeeks={selectedWeeks}
            onWeekSelect={handleWeekSelect}
            onDateSelect={handleDateSelect}
            accommodationTitle=""
            currentMonth={new Date()}
          />
          
          <CabinSelector
            accommodations={accommodations || []}
            selectedAccommodationId={selectedAccommodation}
            onSelectAccommodation={setSelectedAccommodation}
            selectedWeeks={selectedWeeks}
            currentMonth={new Date()}
            displayWeeklyAccommodationPrice={() => null}
          />
        </section>

        <BookingSummary
          selectedWeeks={selectedWeeks}
          selectedAccommodation={selectedAccommodation && accommodations ? 
            accommodations.find(a => a.id === selectedAccommodation) || null : null}
          onClearWeeks={() => setSelectedWeeks([])}
          onClearAccommodation={() => setSelectedAccommodation(null)}
          calculatedWeeklyAccommodationPrice={null}
        />
      </div>
    </div>
  );
}