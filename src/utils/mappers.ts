import { Database } from '../types/database';
import { CalendarConfig, WeekCustomization } from '../types/calendar';

type CalendarConfigRow = Database['public']['Tables']['calendar_config']['Row'];
type WeekCustomizationRow = Database['public']['Tables']['week_customizations']['Row'];

export function mapCalendarConfigFromRow(row: CalendarConfigRow): CalendarConfig {
    return {
        id: row.id,
        checkInDay: row.check_in_day,
        checkOutDay: row.check_out_day,
        createdAt: new Date(row.created_at)
    };
}

export function mapCalendarConfigToRow(config: Partial<CalendarConfig>): Partial<CalendarConfigRow> {
    return {
        check_in_day: config.checkInDay,
        check_out_day: config.checkOutDay
    };
}

export function mapWeekCustomizationFromRow(row: WeekCustomizationRow): WeekCustomization {
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
    return {
        start_date: customization.startDate?.toISOString(),
        end_date: customization.endDate?.toISOString(),
        name: customization.name,
        status: customization.status
    };
}
