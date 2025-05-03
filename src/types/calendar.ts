import { Database } from './database';

// Database types
type CalendarConfigRow = Database['public']['Tables']['calendar_config']['Row'];
type WeekCustomizationRow = Database['public']['Tables']['week_customizations']['Row'];

// Domain types
export interface CalendarConfig {
    id: string;
    checkInDay: number;
    checkOutDay: number;
    createdAt?: Date;
}

export type WeekStatus = 'default' | 'visible' | 'hidden' | 'deleted';

export interface WeekCustomization {
    id: string;
    startDate: Date;
    endDate: Date;
    name?: string | null;
    status: WeekStatus;
    createdBy: string;
    createdAt: Date;
    flexibleDates?: Date[];
    link?: string;
}

export interface Week {
    id?: string;
    startDate: Date;
    endDate: Date;
    name?: string;
    status: WeekStatus;
    isCustom?: boolean;
    isPartialWeek?: boolean;
    isEdgeWeek?: boolean;
    flexibleDates?: Date[];
    isFlexibleSelection?: boolean;
    selectedFlexDate?: Date;
    link?: string;
}

export interface FlexibleCheckin {
    id: string;
    weekCustomizationId: string;
    allowedCheckinDate: Date;
    createdBy?: string;
    createdAt: Date;
}

// Type guards
export function isWeekStatus(status: string): status is WeekStatus {
    return ['visible', 'hidden', 'deleted'].includes(status);
}

// Logging utilities
export function logWeek(prefix: string, week: Week) {
  console.log(`[calendar] ${prefix}:`, {
    dates: {
      start: week.startDate.toISOString(),
      end: week.endDate.toISOString()
    },
    status: week.status,
    name: week.name,
    isCustom: week.isCustom
  });
}

export function logWeeks(prefix: string, weeks: Week[]) {
  console.log(`[calendar] ${prefix}:`, weeks.map(w => ({
    dates: {
      start: w.startDate.toISOString(),
      end: w.endDate.toISOString()
    },
    status: w.status,
    name: w.name,
    isCustom: w.isCustom
  })));
}

export function logCustomization(prefix: string, customization: WeekCustomization) {
  console.log(`[calendar] ${prefix}:`, {
    dates: {
      start: customization.startDate.toISOString(),
      end: customization.endDate.toISOString()
    },
    status: customization.status,
    name: customization.name
  });
}

export function logDateComparison(prefix: string, date1: Date, date2: Date) {
  console.log(`[calendar] ${prefix}:`, {
    date1: date1.toISOString(),
    date2: date2.toISOString(),
    comparison: {
      equals: date1.getTime() === date2.getTime(),
      before: date1 < date2,
      after: date1 > date2,
      diffMs: date2.getTime() - date1.getTime(),
      diffDays: Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24))
    }
  });
}
