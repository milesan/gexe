import { Database } from '../types/database';
import { CalendarConfig, WeekCustomization, WeekStatus } from '../types/calendar';
import { normalizeToUTCDate } from './dates';
import { parseISO } from 'date-fns';

type CalendarConfigRow = Database['public']['Tables']['calendar_config']['Row'];
type WeekCustomizationRow = Database['public']['Tables']['week_customizations']['Row'];

export function mapCalendarConfigFromRow(row: CalendarConfigRow): CalendarConfig {
    console.log('[mappers] Converting DB calendar config to app model:', {
        configId: row.id,
        checkInDay: row.check_in_day,
        checkOutDay: row.check_out_day
    });
    
    return {
        id: row.id,
        checkInDay: row.check_in_day,
        checkOutDay: row.check_out_day,
        createdAt: new Date(row.created_at)
    };
}

export function mapCalendarConfigToRow(config: Partial<CalendarConfig>): Partial<CalendarConfigRow> {
    console.log('[mappers] Converting app calendar config to DB model:', {
        checkInDay: config.checkInDay,
        checkOutDay: config.checkOutDay
    });
    
    return {
        check_in_day: config.checkInDay,
        check_out_day: config.checkOutDay
    };
}

export function mapWeekCustomizationFromRow(row: WeekCustomizationRow & { flexible_checkins?: { allowed_checkin_date: string }[] }): WeekCustomization {
    return {
        id: row.id,
        startDate: parseISO(`${row.start_date}T00:00:00.000Z`),
        endDate: parseISO(`${row.end_date}T00:00:00.000Z`),
        name: row.name,
        status: row.status as WeekStatus,
        createdAt: parseISO(row.created_at),
        createdBy: row.created_by || 'system',
        flexibleDates: row.flexible_checkins?.map((fc: { allowed_checkin_date: string }) => 
            parseISO(`${fc.allowed_checkin_date}T00:00:00.000Z`)
        ) || [],
        link: row.link || undefined
    };
}

export function mapWeekCustomizationToRow(customization: Partial<WeekCustomization>): Partial<WeekCustomizationRow> {
    const startDateStr = customization.startDate?.toISOString();
    const endDateStr = customization.endDate?.toISOString();
    
    console.log('[mappers] Converting app week customization to DB model:', {
        startDate: customization.startDate ? customization.startDate.toISOString() : undefined,
        endDate: customization.endDate ? customization.endDate.toISOString() : undefined,
        dbStartDate: startDateStr,
        dbEndDate: endDateStr,
        status: customization.status,
        durationDays: customization.startDate && customization.endDate ? 
            Math.round((customization.endDate.getTime() - customization.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 
            undefined,
        flexibleDatesCount: customization.flexibleDates?.length,
        link: customization.link
    });
    
    return {
        start_date: customization.startDate?.toISOString(),
        end_date: customization.endDate?.toISOString(),
        name: customization.name === undefined ? null : customization.name,
        status: customization.status,
        link: customization.link === undefined ? null : customization.link
    };
}
