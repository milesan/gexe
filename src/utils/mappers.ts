import { Database } from '../types/database';
import { CalendarConfig, WeekCustomization } from '../types/calendar';

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

export function mapWeekCustomizationFromRow(row: WeekCustomizationRow): WeekCustomization {
    const startDate = new Date(row.start_date);
    const endDate = new Date(row.end_date);
    
    console.log('[mappers] Converting DB week customization to app model:', {
        id: row.id,
        dbStartDate: row.start_date,
        dbEndDate: row.end_date,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: row.status,
        durationDays: Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        startDay: startDate.getDay(),
        endDay: endDate.getDay()
    });
    
    return {
        id: row.id,
        startDate: new Date(row.start_date),
        endDate: new Date(row.end_date),
        name: row.name,
        status: row.status,
        createdAt: new Date(row.created_at),
        createdBy: row.created_by || 'system'
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
            undefined
    });
    
    return {
        start_date: customization.startDate?.toISOString(),
        end_date: customization.endDate?.toISOString(),
        name: customization.name,
        status: customization.status
    };
}
