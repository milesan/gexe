import { supabase } from "../lib/supabase";
import { CalendarConfig, WeekCustomization } from "../types/calendar";
import {
  mapCalendarConfigFromRow,
  mapCalendarConfigToRow,
  mapWeekCustomizationFromRow,
  mapWeekCustomizationToRow
} from "../utils/mappers";

// Helper function for date formatting in logs
function formatDateForDisplay(date: Date): string {
  if (!date) return 'undefined';
  return date.toISOString().split('T')[0];
}

export class CalendarService {
  /**
   * Get the current calendar configuration
   */
  static async getConfig(): Promise<CalendarConfig | null> {
    console.log('[CalendarService] Fetching config');

    const { data, error } = await supabase
      .from('calendar_config')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching calendar config:', error);
      return null;
    }

    console.log('[CalendarService] Successfully fetched config');

    return data ? mapCalendarConfigFromRow(data) : null;
  }

  /**
   * Get week customizations within a date range
   */
  static async getCustomizations(startDate: Date, endDate: Date): Promise<WeekCustomization[]> {
    console.log('[CalendarService] Fetching customizations:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dateRange: {
        diffMs: endDate.getTime() - startDate.getTime(),
        diffDays: Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      }
    });

    try {
      // Get all customizations that overlap with our date range, including deleted ones
      const { data, error } = await supabase
        .from('week_customizations')
        .select('*')
        .gte('start_date', startDate.toISOString())
        .lte('end_date', endDate.toISOString())
        .order('start_date', { ascending: true });

      if (error) {
        console.error('[CalendarService] Error fetching customizations:', error);
        throw error;
      }

      // Use the proper mapping function for each row
      const customizations = data ? data.map(mapWeekCustomizationFromRow) : [];

      // Group customizations by week (same start date)
      const weekGroups = customizations.reduce((groups, cust) => {
        const weekKey = cust.startDate.toISOString().split('T')[0];
        if (!groups[weekKey]) groups[weekKey] = [];
        groups[weekKey].push(cust);
        return groups;
      }, {} as Record<string, WeekCustomization[]>);

      console.log('[CalendarService] Found customizations:', {
        count: customizations.length,
        query: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        groupCount: Object.keys(weekGroups).length,
        weekGroups: Object.entries(weekGroups).map(([key, group]) => ({
          weekStart: key,
          count: group.length,
          statuses: group.map(c => c.status)
        })),
        customizations: customizations.map(c => ({
          id: c.id,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate.toISOString(),
          status: c.status,
          name: c.name,
          createdAt: c.createdAt?.toISOString()
        }))
      });

      return customizations;
    } catch (err) {
      console.error('[CalendarService] Failed to fetch customizations:', err);
      throw err;
    }
  }

  /**
   * Create a new week customization
   */
  static async createCustomization(customization: Omit<WeekCustomization, 'id' | 'createdAt' | 'createdBy'>): Promise<WeekCustomization | null> {
    console.log('[CalendarService] Creating customization:', {
      dates: {
        start: customization.startDate.toISOString(),
        end: customization.endDate.toISOString()
      },
      status: customization.status,
      name: customization.name
    });

    try {
      const row = mapWeekCustomizationToRow(customization);
      const { data, error } = await supabase
        .from('week_customizations')
        .insert(row)
        .select()
        .single();

      if (error) {
        console.error('[CalendarService] Error creating customization:', error);
        throw error;
      }

      console.log('[CalendarService] Successfully created customization with ID:', data.id);

      return data ? mapWeekCustomizationFromRow(data) : null;
    } catch (err) {
      console.error('[CalendarService] Failed to create customization:', err);
      throw err;
    }
  }

  /**
   * Update an existing week customization
   */
  static async updateCustomization(id: string, updates: Partial<Omit<WeekCustomization, 'id' | 'createdAt' | 'createdBy'>>): Promise<WeekCustomization | null> {
    console.log('[CalendarService] Updating customization:', {
      id,
      dates: {
        start: updates.startDate?.toISOString(),
        end: updates.endDate?.toISOString()
      },
      status: updates.status,
      name: updates.name
    });

    try {
      // First check if the customization with this ID exists
      const { data: existingData, error: checkError } = await supabase
        .from('week_customizations')
        .select('*')
        .eq('id', id)
        .single();

      if (checkError) {
        console.log('[CalendarService] ID not found, will create new customization instead');
        
        // ID not found, create a new record instead
        if (updates.startDate && updates.endDate && updates.status) {
          return await CalendarService.createCustomization({
            startDate: updates.startDate,
            endDate: updates.endDate,
            status: updates.status,
            name: updates.name
          });
        } else {
          console.error('[CalendarService] Cannot create new customization - missing required fields');
          throw new Error('Missing required fields for new customization');
        }
      }

      // If we get here, the ID exists, so proceed with update
      // Get the existing customization (for logging and validation)
      const existingCustomization = mapWeekCustomizationFromRow(existingData);
      console.log('[CalendarService] Found existing customization:', {
        existingStart: formatDateForDisplay(existingCustomization.startDate),
        existingEnd: formatDateForDisplay(existingCustomization.endDate),
        existingStatus: existingCustomization.status,
        existingName: existingCustomization.name,
        updateStart: updates.startDate ? formatDateForDisplay(updates.startDate) : undefined,
        updateEnd: updates.endDate ? formatDateForDisplay(updates.endDate) : undefined
      });

      // Create the update payload
      const updateData = mapWeekCustomizationToRow(updates);
      
      // Update the customization
      const { data, error } = await supabase
        .from('week_customizations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[CalendarService] Error updating customization:', error);
        throw error;
      }

      console.log('[CalendarService] Successfully updated customization with ID:', id);

      return data ? mapWeekCustomizationFromRow(data) : null;
    } catch (err) {
      console.error('[CalendarService] Failed to update customization:', err);
      throw err;
    }
  }

  /**
   * Delete a week customization (soft delete)
   */
  static async deleteCustomization(id: string): Promise<boolean> {
    console.log('[CalendarService] Deleting customization:', id);

    try {
      const { error } = await supabase
        .from('week_customizations')
        .update({ status: 'deleted' })
        .eq('id', id);

      if (error) {
        console.error('[CalendarService] Error deleting customization:', error);
        throw error;
      }

      console.log('[CalendarService] Successfully deleted customization');

      return true;
    } catch (err) {
      console.error('[CalendarService] Failed to delete customization:', err);
      throw err;
    }
  }

  /**
   * Handle overlapping weeks by either deleting them or adjusting their dates
   */
  private static async handleOverlappingWeeks(startDate: Date, endDate: Date, excludeId?: string): Promise<void> {
    console.log('[CalendarService] Handling overlapping weeks:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      excludeId
    });

    try {
      // Validate dates
      if (startDate >= endDate) {
        console.error('[CalendarService] Invalid dates: start date must be before end date');
        throw new Error('Start date must be before end date');
      }

      // Get all weeks that overlap with the given date range
      let query = supabase
        .from('week_customizations')
        .select('*')
        .or(`and(start_date.lte.${endDate.toISOString().split('T')[0]},end_date.gte.${startDate.toISOString().split('T')[0]})`)
        .neq('status', 'deleted');

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      console.log('[CalendarService] Executing query:', {
        query: query.toSQL(),
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      const { data: overlapping, error } = await query;

      if (error) {
        console.error('[CalendarService] Error checking for overlapping weeks:', error);
        throw error;
      }

      if (!overlapping || overlapping.length === 0) {
        console.log('[CalendarService] No overlapping weeks found');
        return;
      }

      console.log('[CalendarService] Found overlapping weeks:', overlapping.length);

      // For each overlapping week, decide how to handle it
      for (const week of overlapping) {
        const weekStart = new Date(week.start_date);
        const weekEnd = new Date(week.end_date);

        console.log('[CalendarService] Processing overlapping week:', {
          id: week.id,
          start: weekStart.toISOString(),
          end: weekEnd.toISOString()
        });

        // Case 1: Week is completely engulfed by new dates
        if (weekStart >= startDate && weekEnd <= endDate) {
          console.log('[CalendarService] Deleting engulfed week:', week.id);
          await this.deleteCustomization(week.id);
          continue;
        }

        // Case 2: Week completely engulfs new dates
        if (weekStart <= startDate && weekEnd >= endDate) {
          console.log('[CalendarService] Splitting engulfing week');
          // Create two new weeks if there's space on both sides
          if (weekStart < startDate) {
            await this.createCustomization({
              startDate: weekStart,
              endDate: new Date(startDate.getTime() - 86400000), // day before startDate
              status: week.status,
              name: week.name
            });
          }
          if (weekEnd > endDate) {
            await this.createCustomization({
              startDate: new Date(endDate.getTime() + 86400000), // day after endDate
              endDate: weekEnd,
              status: week.status,
              name: week.name
            });
          }
          await this.deleteCustomization(week.id);
          continue;
        }

        // Case 3: Week overlaps at start
        if (weekStart < startDate && weekEnd > startDate && weekEnd <= endDate) {
          console.log('[CalendarService] Adjusting week end date');
          await this.updateCustomization(week.id, {
            endDate: new Date(startDate.getTime() - 86400000)
          });
          continue;
        }

        // Case 4: Week overlaps at end
        if (weekStart >= startDate && weekStart < endDate && weekEnd > endDate) {
          console.log('[CalendarService] Adjusting week start date');
          await this.updateCustomization(week.id, {
            startDate: new Date(endDate.getTime() + 86400000)
          });
          continue;
        }
      }
    } catch (err) {
      console.error('[CalendarService] Failed to handle overlapping weeks:', err);
      throw err;
    }
  }

  /**
   * Update the calendar configuration
   */
  static async updateConfig(config: Partial<Omit<CalendarConfig, 'id' | 'createdAt'>>): Promise<CalendarConfig | null> {
    console.log('[CalendarService] Updating config:', config);

    try {
      const updateData: any = {};

      if (typeof config.checkInDay === 'number') {
        updateData.check_in_day = config.checkInDay;
      }
      if (typeof config.checkOutDay === 'number') {
        updateData.check_out_day = config.checkOutDay;
      }

      const { data, error } = await supabase
        .from('calendar_config')
        .update(updateData)
        .select()
        .single();

      if (error) {
        console.error('Error updating calendar config:', error);
        throw error;
      }

      console.log('[CalendarService] Successfully updated config');

      return data ? mapCalendarConfigFromRow(data) : null;
    } catch (err) {
      console.error('[CalendarService] Failed to update config:', err);
      throw err;
    }
  }
}
