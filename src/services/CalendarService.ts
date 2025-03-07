import { supabase } from "../lib/supabase";
import { CalendarConfig, WeekCustomization, WeekStatus } from "../types/calendar";
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

    return data ? mapCalendarConfigFromRow(data) : null;
  }

  /**
   * Get week customizations within a date range
   */
  static async getCustomizations(startDate: Date, endDate: Date): Promise<WeekCustomization[]> {
    console.log('[CalendarService] Fetching customizations');

    try {
      // Get all customizations that overlap with our date range
      const { data, error } = await supabase
        .from('week_customizations')
        .select('*')
        .or(`start_date.lte.${endDate.toISOString()},end_date.gte.${startDate.toISOString()}`)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('[CalendarService] Error fetching customizations:', error);
        throw error;
      }

      // Map to proper types
      return data ? data.map(mapWeekCustomizationFromRow) : [];
    } catch (err) {
      console.error('[CalendarService] Failed to fetch customizations:', err);
      throw err;
    }
  }

  /**
   * Create a new week customization
   */
  static async createCustomization(customization: {
    startDate: Date;
    endDate: Date;
    status: string;
    name?: string;
  }): Promise<WeekCustomization | null> {
    console.log('[CalendarService] Creating customization:', {
      startDate: formatDateForDisplay(customization.startDate),
      endDate: formatDateForDisplay(customization.endDate),
      status: customization.status
    });
    
    try {
      // First, get all existing weeks in the date range that might overlap
      const { data: existingWeeks } = await supabase
        .from('week_customizations')
        .select('*')
        .or(`start_date.lte.${customization.endDate.toISOString()},end_date.gte.${customization.startDate.toISOString()}`);
      
      // Check for exact match first
      const exactMatch = existingWeeks?.find(w => 
        new Date(w.start_date).toISOString().split('T')[0] === customization.startDate.toISOString().split('T')[0] &&
        new Date(w.end_date).toISOString().split('T')[0] === customization.endDate.toISOString().split('T')[0]
      );
      
      if (exactMatch) {
        console.log('[CalendarService] Found exact date match - updating instead');
        const { data, error } = await supabase
          .from('week_customizations')
          .update({
            status: customization.status,
            name: customization.name
          })
          .eq('id', exactMatch.id)
          .select()
          .single();
          
        if (error) {
          throw error;
        }
        
        return data ? mapWeekCustomizationFromRow(data) : null;
      }
      
      // Handle overlapping weeks - but PRESERVE non-overlapping parts instead of deleting them
      const overlaps = existingWeeks?.filter(w => 
        new Date(w.end_date) >= customization.startDate && 
        new Date(w.start_date) <= customization.endDate
      ) || [];
      
      if (overlaps.length > 0) {
        console.log(`[CalendarService] Processing ${overlaps.length} overlapping weeks with preservation`);
        
        for (const week of overlaps) {
          const weekStartDate = new Date(week.start_date);
          const weekEndDate = new Date(week.end_date);
          
          // There are multiple overlap cases to handle:
          
          // Case 1: Week is completely contained in our new customization - delete it
          if (weekStartDate >= customization.startDate && weekEndDate <= customization.endDate) {
            console.log(`[CalendarService] Completely removing contained week: ${formatDateForDisplay(weekStartDate)} - ${formatDateForDisplay(weekEndDate)}`);
            await supabase
              .from('week_customizations')
              .delete()
              .eq('id', week.id);
            
          // Case 2: Our new customization is in the middle of a week - split into two parts
          } else if (weekStartDate < customization.startDate && weekEndDate > customization.endDate) {
            console.log(`[CalendarService] Splitting week into two parts: ${formatDateForDisplay(weekStartDate)} - ${formatDateForDisplay(weekEndDate)}`);
            
            // Update the original to be the first part
            await supabase
              .from('week_customizations')
              .update({
                end_date: new Date(customization.startDate.getTime() - 86400000).toISOString() // day before our customization
              })
              .eq('id', week.id);
            
            // Create a new week for the second part
            await supabase
              .from('week_customizations')
              .insert({
                start_date: new Date(customization.endDate.getTime() + 86400000).toISOString(), // day after our customization  
                end_date: weekEndDate.toISOString(),
                status: week.status,
                name: week.name
              });
            
          // Case 3: Overlap at start - truncate existing week's end
          } else if (weekStartDate < customization.startDate && weekEndDate >= customization.startDate) {
            console.log(`[CalendarService] Preserving start of week: ${formatDateForDisplay(weekStartDate)} - ${formatDateForDisplay(new Date(customization.startDate.getTime() - 86400000))}`);
            
            await supabase
              .from('week_customizations')
              .update({
                end_date: new Date(customization.startDate.getTime() - 86400000).toISOString() // day before our customization
              })
              .eq('id', week.id);
            
          // Case 4: Overlap at end - truncate existing week's start  
          } else if (weekStartDate <= customization.endDate && weekEndDate > customization.endDate) {
            console.log(`[CalendarService] Preserving end of week: ${formatDateForDisplay(new Date(customization.endDate.getTime() + 86400000))} - ${formatDateForDisplay(weekEndDate)}`);
            
            await supabase
              .from('week_customizations')
              .update({
                start_date: new Date(customization.endDate.getTime() + 86400000).toISOString() // day after our customization
              })
              .eq('id', week.id);
          }
        }
      }
      
      // Create the new week
      const { data: newWeek, error } = await supabase
        .from('week_customizations')
        .insert({
          start_date: customization.startDate.toISOString(),
          end_date: customization.endDate.toISOString(),
          status: customization.status,
          name: customization.name
        })
        .select()
        .single();
        
      if (error) {
        console.error('[CalendarService] Failed to create customization:', error);
        return null;
      }
      
      console.log('[CalendarService] Successfully created customization with ID:', newWeek.id);
      return mapWeekCustomizationFromRow(newWeek);
    } catch (err) {
      console.error('[CalendarService] Failed to create customization:', err);
      return null;
    }
  }

  /**
   * Update an existing week customization
   */
  static async updateCustomization(
    id: string,
    updates: Partial<WeekCustomization>
  ): Promise<WeekCustomization | null> {
    console.log('[CalendarService] Updating customization:', id);
    
    try {
      const result = await CalendarService.processWeekOperations([{
        type: 'update',
        week: {
          id,
          startDate: updates.startDate,
          endDate: updates.endDate,
          status: updates.status,
          name: updates.name
        }
      }]);
      
      if (!result) {
        return null;
      }
      
      // For non-date updates, get the updated week
      if (!updates.startDate && !updates.endDate) {
        const { data } = await supabase
          .from('week_customizations')
          .select('*')
          .eq('id', id)
          .single();
          
        return data ? mapWeekCustomizationFromRow(data) : null;
      } else {
        // For date updates, the week ID has changed, so we need to find by dates
        const { data } = await supabase
          .from('week_customizations')
          .select('*')
          .eq('start_date', updates.startDate!.toISOString())
          .eq('end_date', updates.endDate!.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        return data ? mapWeekCustomizationFromRow(data) : null;
      }
    } catch (err) {
      console.error('[CalendarService] Failed to update customization:', err);
      return null;
    }
  }

  /**
   * Delete a week customization
   */
  static async deleteCustomization(id: string): Promise<boolean> {
    console.log('[CalendarService] Deleting customization:', id);
    
    return await CalendarService.processWeekOperations([{
      type: 'delete',
      week: { id }
    }]);
  }

  private static async fillGap(
    gapStart: Date,
    gapEnd: Date,
    checkInDay: number,
    checkOutDay: number
  ): Promise<void> {
    let currentDate = new Date(gapStart);
    
    // If not starting on a check-in day and there's room for a partial week
    if (currentDate.getDay() !== checkInDay) {
      const nextCheckIn = new Date(currentDate);
      const daysToAdd = (checkInDay - nextCheckIn.getDay() + 7) % 7;
      nextCheckIn.setDate(nextCheckIn.getDate() + daysToAdd);
      
      // Only create partial week if it doesn't extend beyond gap
      if (nextCheckIn <= gapEnd) {
        // Create partial week up to next check-in
        await supabase
          .from('week_customizations')
          .insert({
            start_date: currentDate.toISOString(),
            end_date: new Date(nextCheckIn.getTime() - 86400000).toISOString(),
            status: 'visible'
          });
        currentDate = nextCheckIn;
      }
    }
    
    // Fill remaining gap with full weeks where possible
    while (currentDate <= gapEnd) {
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(currentDate.getDate() + 6); // Standard 7-day week
      
      // If this would go beyond gap end, adjust to gap end
      const endDate = weekEnd > gapEnd ? gapEnd : weekEnd;
      
      // Create week
      await supabase
        .from('week_customizations')
        .insert({
          start_date: currentDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'visible'
        });
      
      if (weekEnd > gapEnd) break;
      
      // Move to next week
      currentDate = new Date(weekEnd.getTime() + 86400000);
    }
  }

  /**
   * Update the calendar configuration
   */
  static async updateConfig(config: CalendarConfig): Promise<void> {
    try {
      console.log('[CalendarService] Updating calendar config:', config);

      // First check if we have any config rows
      const { data: existingConfig } = await supabase
        .from('calendar_config')
        .select('*')
        .limit(1);

      if (existingConfig && existingConfig.length > 0) {
        // If we have a config, update the first row
        const { error } = await supabase
          .from('calendar_config')
          .update({
            check_in_day: config.checkInDay,
            check_out_day: config.checkOutDay
          })
          .eq('id', existingConfig[0].id); // Add WHERE clause here
        
        if (error) throw error;
        console.log('[CalendarService] Config updated successfully');
      } else {
        // If no config exists yet, insert one
        const { error } = await supabase
          .from('calendar_config')
          .insert({
            check_in_day: config.checkInDay,
            check_out_day: config.checkOutDay
          });
        
        if (error) throw error;
        console.log('[CalendarService] Config created successfully');
      }
    } catch (err) {
      console.error('[CalendarService] Failed to update config:', err);
      throw err;
    }
  }

  /**
   * Process a queue of week operations without recursion
   */
  static async processWeekOperations(operations: Array<{
    type: 'create' | 'update' | 'delete';
    week: {
      id?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
      name?: string | null;
    }
  }>): Promise<boolean> {
    console.log('[CalendarService] Processing week operations batch:', operations.length);
    
    try {
      // First, get all existing weeks in the date range
      const allDates = operations.flatMap(op => [
        op.week.startDate, 
        op.week.endDate
      ]).filter(Boolean) as Date[];
      
      if (allDates.length === 0) {
        return true;
      }
      
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
      
      // Load all weeks that might be affected
      const { data: existingWeeks } = await supabase
        .from('week_customizations')
        .select('*')
        .or(`start_date.lte.${maxDate.toISOString()},end_date.gte.${minDate.toISOString()}`);
      
      // Handle all operations in order
      for (const op of operations) {
        if (op.type === 'create') {
          // For create, first check if we have a week with exact dates
          const exactMatch = existingWeeks?.find(w => 
            new Date(w.start_date).toISOString().split('T')[0] === op.week.startDate?.toISOString().split('T')[0] &&
            new Date(w.end_date).toISOString().split('T')[0] === op.week.endDate?.toISOString().split('T')[0]
          );
          
          if (exactMatch) {
            // Update the existing week
            await supabase
              .from('week_customizations')
              .update({
                status: op.week.status,
                name: op.week.name
              })
              .eq('id', exactMatch.id);
          } else {
            // Find any overlapping weeks and delete them
            const overlaps = existingWeeks?.filter(w => 
              new Date(w.end_date) >= op.week.startDate! && 
              new Date(w.start_date) <= op.week.endDate!
            ) || [];
            
            // Delete all overlapping weeks
            for (const overlap of overlaps) {
              await supabase
                .from('week_customizations')
                .delete()
                .eq('id', overlap.id);
            }
            
            // Create the new week
            await supabase
              .from('week_customizations')
              .insert({
                start_date: op.week.startDate!.toISOString(),
                end_date: op.week.endDate!.toISOString(),
                status: op.week.status,
                name: op.week.name
              });
          }
        } else if (op.type === 'update' && op.week.id) {
          // If only updating status/name, do direct update
          if (!op.week.startDate && !op.week.endDate) {
            await supabase
              .from('week_customizations')
              .update({
                status: op.week.status,
                name: op.week.name === undefined ? null : op.week.name
              })
              .eq('id', op.week.id);
          } else {
            // For date changes: delete and recreate
            // First find the existing week to get its full data
            const existingWeek = existingWeeks?.find(w => w.id === op.week.id);
            if (!existingWeek) continue;
            
            // Delete it
            await supabase
              .from('week_customizations')
              .delete()
              .eq('id', op.week.id);
            
            // Then add the create operation to our queue
            operations.push({
              type: 'create',
              week: {
                startDate: op.week.startDate || new Date(existingWeek.start_date),
                endDate: op.week.endDate || new Date(existingWeek.end_date),
                status: op.week.status || existingWeek.status,
                name: op.week.name === undefined ? existingWeek.name : op.week.name
              }
            });
          }
        } else if (op.type === 'delete' && op.week.id) {
          // Simple delete
          await supabase
            .from('week_customizations')
            .delete()
            .eq('id', op.week.id);
        }
      }
      
      return true;
    } catch (err) {
      console.error('[CalendarService] Error processing week operations:', err);
      return false;
    }
  }
}
