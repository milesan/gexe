okay basically i think this is what i want to do

whenever the week loads their weeks. they get a start date and end date for all the weeks they want to load

they check (some place) where are the week start and end days of week by default (think of a good place to store this, dont look where it currently is)

then, it goes to load the first week. it checks week_customizations , whether there are any customizations within that time frame

if not it creates that week

if there are (these can be 'hidden','deleted', 'visible'), then it takes that into account.

let's stay it started making weeks from 1st Jan.

it tries to create a week from 1st jan to 7th jan

it sees that there is a custommization in week_customizations, starting from 3rd Jan to 12th jan

it finished making week from 1st jan to 2nd jan

it makes the customization from 3rd jan 12th jan (visible)

it contienus by default from 13th jan to (default checkout day), and so on

---

I understand now - you want to dynamically generate weeks while taking into account any customizations that might split or modify the default weeks. Let's implement this:

First, let's store the default week configuration in the database:
sql
CopyInsert
create table calendar_config (
    id uuid primary key default uuid_generate_v4(),
    check_in_day smallint not null check (check_in_day between 0 and 6), -- 0 = Sunday, 1 = Monday, etc.
    check_out_day smallint not null check (check_out_day between 0 and 6),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table week_customizations (
    id uuid primary key default uuid_generate_v4(),
    start_date date not null,
    end_date date not null,
    name text,
    status text not null check (status in ('visible', 'hidden', 'deleted')),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);
Now let's create the week generation logic:

Edit:
dates.ts
+94
-0
81
94 insertions (+)
0 deletions (-)
81 unchanged
Preview
Apply
import { addDays, startOfDay, endOfDay, isBefore, isAfter, isSameDay } from 'date-fns';

interface WeekCustomization {
  id: string;
  startDate: Date;
  endDate: Date;
  name?: string;
  status: 'visible' | 'hidden' | 'deleted';
}

interface CalendarConfig {
  checkInDay: number;  // 0-6, where 0 is Sunday
  checkOutDay: number; // 0-6
}

interface Week {
  startDate: Date;
  endDate: Date;
  name?: string;
  status: 'default' | 'visible' | 'hidden' | 'deleted';
  isCustom: boolean;
}

export function generateWeeksWithCustomizations(
  startDate: Date,
  endDate: Date,
  calendarConfig: CalendarConfig,
  customizations: WeekCustomization[]
): Week[] {
  const weeks: Week[] = [];
  let currentDate = startOfDay(startDate);
  const finalEndDate = endOfDay(endDate);

  // Sort customizations by start date
  const sortedCustomizations = [...customizations].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  while (isBefore(currentDate, finalEndDate)) {
    // Check if there's a customization that affects the current date
    const overlappingCustomization = sortedCustomizations.find(
      custom => 
        !isAfter(custom.startDate, currentDate) && 
        !isBefore(custom.endDate, currentDate)
    );

    if (overlappingCustomization) {
      // Add the customized week
      weeks.push({
        startDate: overlappingCustomization.startDate,
        endDate: overlappingCustomization.endDate,
        name: overlappingCustomization.name,
        status: overlappingCustomization.status,
        isCustom: true
      });

      // Move to the day after this customization
      currentDate = addDays(overlappingCustomization.endDate, 1);
    } else {
      // Find next customization if any
      const nextCustomization = sortedCustomizations.find(
        custom => isAfter(custom.startDate, currentDate)
      );

      // Calculate the end of the current default week
      let weekEnd: Date;
      
      if (nextCustomization && isBefore(nextCustomization.startDate, addDays(currentDate, 7))) {
        // If there's a customization starting before the default week would end,
        // end this week right before the customization
        weekEnd = addDays(nextCustomization.startDate, -1);
      } else {
        // Otherwise, create a normal week based on calendar config
        const daysToAdd = (7 + calendarConfig.checkOutDay - calendarConfig.checkInDay) % 7;
        weekEnd = addDays(currentDate, daysToAdd);
      }

      // Add the default week
      if (!isSameDay(currentDate, weekEnd)) {
        weeks.push({
          startDate: currentDate,
          endDate: weekEnd,
          status: 'default',
          isCustom: false
        });
      }

      // Move to the next day
      currentDate = addDays(weekEnd, 1);
    }
  }

  return weeks;
}
Now let's update the Book2Page component to use this new system:

Edit:
Book2Page.tsx
+89
-40
172
Preview
Apply
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, Settings } from 'lucide-react';
import { startOfMonth, format, addMonths, isSameMonth } from 'date-fns';
import { WeekSelector } from '../components/WeekSelector';
import { CabinSelector } from '../components/CabinSelector';
import { BookingSummary } from '../components/BookingSummary';
import { MaxWeeksModal } from '../components/MaxWeeksModal';
import { generateWeeksWithCustomizations } from '../utils/dates';
import { useWeeklyAccommodations } from '../hooks/useWeeklyAccommodations';
import { useSession } from '../hooks/useSession';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { convertToUTC1 } from '../utils/timezone';

const WEEKS_TO_SHOW = 16;
const BASE_RATE = 3;
const BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1510798831971-661eb04b3739?q=80&w=2940&auto=format&fit=crop";

interface Week {
  startDate: Date;
  endDate: Date;
  name?: string;
  status: 'default' | 'visible' | 'hidden' | 'deleted';
  isCustom: boolean;
}

export function Book2Page() {
  const { accommodations, loading, error, checkWeekAvailability, availabilityMap } = useWeeklyAccommodations();
  const [selectedWeeks, setSelectedWeeks] = useState<Week[]>([]);
  const [selectedAccommodation, setSelectedAccommodation] = useState<string | null>(null);
  const startDate = useMemo(() => convertToUTC1(new Date('2024-12-16'), 0), []);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(startDate));
  const [showMaxWeeksModal, setShowMaxWeeksModal] = useState(false);
  const session = useSession();
  const isAdmin = session?.user?.email === 'andre@thegarden.pt' || session?.user?.email === 'redis213@gmail.com';

  // State for calendar configuration and customizations
  const [calendarConfig, setCalendarConfig] = useState({ checkInDay: 1, checkOutDay: 0 }); // Default Mon-Sun
  const [weekCustomizations, setWeekCustomizations] = useState<WeekCustomization[]>([]);

  // Fetch calendar configuration and customizations
  useEffect(() => {
    async function fetchCalendarData() {
      // Fetch calendar config
      const { data: configData } = await supabase
        .from('calendar_config')
        .select('*')
        .single();
      
      if (configData) {
        setCalendarConfig({
          checkInDay: configData.check_in_day,
          checkOutDay: configData.check_out_day
        });
      }

      // Fetch week customizations
      const { data: customizations } = await supabase
        .from('week_customizations')
        .select('*')
        .gte('end_date', startDate.toISOString());

      if (customizations) {
        setWeekCustomizations(customizations.map(c => ({
          ...c,
          startDate: new Date(c.start_date),
          endDate: new Date(c.end_date)
        })));
      }
    }

    fetchCalendarData();
  }, [startDate]);

  // Generate weeks with customizations
  const weeks = useMemo(() => 
    generateWeeksWithCustomizations(
      currentMonth,
      addMonths(currentMonth, 2), // Generate 2 months worth of weeks
      calendarConfig,
      weekCustomizations
    ),
    [currentMonth, calendarConfig, weekCustomizations]
  );

  // Check if a week is available
  const isWeekAvailable = useCallback((week: Week) => {
    if (week.status === 'hidden' || week.status === 'deleted') return false;
    if (!selectedAccommodation) return true;
    
    const availability = availabilityMap[selectedAccommodation];
    return availability?.isAvailable ?? false;
  }, [selectedAccommodation, availabilityMap]);

  // Handle week selection
  const toggleWeek = (week: Week) => {
    if (!isWeekAvailable(week)) return;

    setSelectedWeeks(prev => {
      const isSelected = prev.some(w => 
        w.startDate.getTime() === week.startDate.getTime() && 
        w.endDate.getTime() === week.endDate.getTime()
      );
      
      if (isSelected) {
        return prev.filter(w => 
          w.startDate.getTime() !== week.startDate.getTime() || 
          w.endDate.getTime() !== week.endDate.getTime()
        );
      }

      const newWeeks = [...prev, week].sort((a, b) => 
        a.startDate.getTime() - b.startDate.getTime()
      );
      
      if (newWeeks.length > 12) {
        setShowMaxWeeksModal(true);
        return prev;
      }

      // Check availability if accommodation is selected
      if (selectedAccommodation) {
        const accommodation = accommodations.find(a => a.id === selectedAccommodation);
        if (accommodation) {
          checkWeekAvailability(accommodation, newWeeks.map(w => w.startDate));
        }
      }

      return newWeeks;
    });
  };

  {{ ... rest of the component remains the same ... }}
}
This implementation:

Stores Configuration:
Calendar config (check-in/out days) in calendar_config table
Custom weeks in week_customizations table
Week Generation Logic:
Starts from a given start date
Checks for any customizations that overlap
Creates default weeks where there are no customizations
Handles partial weeks when customizations split them
Preserves custom week names and statuses
Example Flow:
typescript
CopyInsert
// Given:
startDate = Jan 1
calendarConfig = { checkInDay: 1, checkOutDay: 0 } // Mon-Sun
customizations = [{
  startDate: Jan 3,
  endDate: Jan 12,
  status: 'visible',
  name: 'Custom Week'
}]

// Generated weeks:
[
  {
    startDate: Jan 1,
    endDate: Jan 2,
    status: 'default',
    isCustom: false
  },
  {
    startDate: Jan 3,
    endDate: Jan 12,
    status: 'visible',
    name: 'Custom Week',
    isCustom: true
  },
  {
    startDate: Jan 13,
    endDate: Jan 19,
    status: 'default',
    isCustom: false
  },
  // ... continues
]
Would you like me to also:

Create the database migration for the new tables?
Add the admin interface for managing calendar configuration?
Update the WeekSelector/WeekBox components to show the custom weeks properly?

---

Here's a step-by-step implementation plan that we can test at each stage:

Database Setup (Test: Can create and query tables)
sql
CopyInsert
-- Step 1a: Create calendar_config table
create table calendar_config (
    id uuid primary key default uuid_generate_v4(),
    check_in_day smallint not null check (check_in_day between 0 and 6),
    check_out_day smallint not null check (check_out_day between 0 and 6),
    created_at timestamptz default now()
);

-- Step 1b: Create week_customizations table
create table week_customizations (
    id uuid primary key default uuid_generate_v4(),
    start_date date not null,
    end_date date not null,
    name text,
    status text not null check (status in ('visible', 'hidden', 'deleted')),
    created_by uuid references auth.users(id),
    created_at timestamptz default now()
);
Type Definitions (Test: TypeScript compilation)
typescript
CopyInsert
// types/calendar.ts
export interface CalendarConfig {
    id: string;
    checkInDay: number;
    checkOutDay: number;
}

export interface WeekCustomization {
    id: string;
    startDate: Date;
    endDate: Date;
    name?: string;
    status: 'visible' | 'hidden' | 'deleted';
}

export interface Week {
    startDate: Date;
    endDate: Date;
    name?: string;
    status: 'default' | 'visible' | 'hidden' | 'deleted';
    isCustom: boolean;
}
Week Generation Logic (Test: Unit tests with different scenarios)
typescript
CopyInsert
// utils/dates.ts
export function generateWeeksWithCustomizations(
    startDate: Date,
    endDate: Date,
    calendarConfig: CalendarConfig,
    customizations: WeekCustomization[]
): Week[]
Database Access Layer (Test: CRUD operations)
typescript
CopyInsert
// services/CalendarService.ts
export class CalendarService {
    getConfig(): Promise<CalendarConfig>;
    getCustomizations(startDate: Date, endDate: Date): Promise<WeekCustomization[]>;
    createCustomization(customization: Omit<WeekCustomization, 'id'>): Promise<WeekCustomization>;
    updateCustomization(id: string, updates: Partial<WeekCustomization>): Promise<WeekCustomization>;
    deleteCustomization(id: string): Promise<void>;
}
React Hook for Calendar (Test: Component integration)
typescript
CopyInsert
// hooks/useCalendar.ts
export function useCalendar(startDate: Date, endDate: Date) {
    const [config, setConfig] = useState<CalendarConfig | null>(null);
    const [customizations, setCustomizations] = useState<WeekCustomization[]>([]);
    const weeks = useMemo(() => 
        generateWeeksWithCustomizations(startDate, endDate, config, customizations),
        [startDate, endDate, config, customizations]
    );
    // ... loading, error handling, CRUD operations
}
Update WeekBox Component (Test: Visual testing)
typescript
CopyInsert
// components/WeekBox.tsx
interface Props {
    week: Week;
    isSelected: boolean;
    isSelectable: boolean;
    onClick: () => void;
}
Update WeekSelector Component (Test: Integration testing)
typescript
CopyInsert
// components/WeekSelector.tsx
interface Props {
    weeks: Week[];
    selectedWeeks: Week[];
    onSelectWeek: (week: Week) => void;
    isAdmin?: boolean;
}
Admin Customization UI (Test: User interaction)
typescript
CopyInsert
// components/admin/CalendarCustomizer.tsx
interface Props {
    onCustomize: (customization: Omit<WeekCustomization, 'id'>) => Promise<void>;
}