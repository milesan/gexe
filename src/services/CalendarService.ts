import { supabase } from "../lib/supabase";
import { CalendarConfig, WeekCustomization, WeekStatus, Week } from "../types/calendar";
import {
  mapCalendarConfigFromRow,
  mapCalendarConfigToRow,
  mapWeekCustomizationFromRow,
  mapWeekCustomizationToRow
} from "../utils/mappers";
import { 
  normalizeToUTCDate, 
  formatDateForDisplay, 
  doDateRangesOverlap,
  generateStandardWeek,
  generateWeeksWithCustomizations
} from '../utils/dates';
import { addDays, isSameDay, parseISO } from 'date-fns';

/**
 * CalendarService - Manages all calendar-related operations
 * 
 * This service centralizes all calendar business logic including:
 * - Calendar configuration (check-in/check-out days)
 * - Week customizations (status, name, date range)
 * - Flexible check-in dates
 * - Week overlap resolution
 */
export class CalendarService {
  private static instance: CalendarService;

  private constructor() {}

  public static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  /**
   * Get the current calendar configuration
   * @returns The current calendar configuration or null if not set
   */
  static async getConfig(): Promise<CalendarConfig | null> {
    console.log('[CalendarService] Getting calendar config');
    const { data, error } = await supabase
      .from('calendar_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[CalendarService] Error getting calendar config:', error);
      return null;
    }

    return data ? {
      id: data.id,
      checkInDay: data.check_in_day,
      checkOutDay: data.check_out_day
    } : null;
  }

  /**
   * Update the calendar configuration
   * @param config The new calendar configuration
   * @returns The updated configuration
   */
  static async updateConfig(config: { checkInDay: number; checkOutDay: number }) {
    console.log('[CalendarService] Updating calendar config:', config);
    
    try {
      // First, get the existing config to get its ID
      const existingConfig = await this.getConfig();
      
      if (!existingConfig || !existingConfig.id) {
        console.error('[CalendarService] No existing config found to update or missing ID');
        
        // If no config exists, create a new one
        const { data: insertData, error: insertError } = await supabase
          .from('calendar_config')
          .insert({
            check_in_day: config.checkInDay,
            check_out_day: config.checkOutDay
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('[CalendarService] Error creating new calendar config:', insertError);
          throw insertError;
        }
        
        return insertData;
      }
      
      console.log('[CalendarService] Updating existing config with ID:', existingConfig.id);
      
      // Now update the existing row using its ID
      const { data, error } = await supabase
        .from('calendar_config')
        .update({
          check_in_day: config.checkInDay,
          check_out_day: config.checkOutDay
        })
        .eq('id', existingConfig.id)
        .select()
        .single();
  
      if (error) {
        console.error('[CalendarService] Error updating calendar config:', error);
        throw error;
      }
  
      return data;
    } catch (err) {
      console.error('[CalendarService] Error in updateConfig:', err);
      throw err;
    }
  }

  /**
   * Get all week customizations within a date range
   * @param startDate The start date of the range
   * @param endDate The end date of the range
   * @param isAdminMode Whether to include admin-only weeks
   * @returns Array of weeks
   */
  static async getWeeks(startDate: Date, endDate: Date, isAdminMode: boolean = false): Promise<Week[]> {
    // Get calendar config
    const config = await this.getConfig();
    
    // Get customizations
    const customizations = await this.getCustomizations(startDate, endDate);
    
    // Generate weeks with customizations
    return generateWeeksWithCustomizations(
      startDate,
      endDate,
      config,
      customizations,
      isAdminMode
    );
  }

  /**
   * Get customizations within a date range
   * @param startDate Start date of the range
   * @param endDate End date of the range
   * @returns Array of customizations
   */
  static async getCustomizations(startDate: Date, endDate: Date): Promise<WeekCustomization[]> {
    const normalizedStart = normalizeToUTCDate(startDate);
    const normalizedEnd = normalizeToUTCDate(endDate);

    console.log('[CalendarService] Getting customizations between:', {
      normalizedStart: formatDateForDisplay(normalizedStart),
      normalizedEnd: formatDateForDisplay(normalizedEnd),
      startDate: formatDateForDisplay(startDate),
      endDate: formatDateForDisplay(endDate)
    });

    const { data: customizations, error } = await supabase
      .from('week_customizations')
      .select(`
        *,
        flexible_checkins (
          allowed_checkin_date
        )
      `)
      .or(`start_date.lte.${normalizedEnd.toISOString()},end_date.gte.${normalizedStart.toISOString()}`);

    if (error) {
      console.error('[CalendarService] Error getting customizations:', error);
      throw error;
    }

    // Log the raw data received from Supabase BEFORE mapping
    console.log('[CalendarService] Raw data from Supabase:', customizations);

    return customizations.map(row => ({
      ...mapWeekCustomizationFromRow(row),
      flexibleDates: row.flexible_checkins?.map((fc: { allowed_checkin_date: string }) => 
        parseISO(`${fc.allowed_checkin_date}T00:00:00.000Z`)
      ) || []
    }));
  }

  /**
   * Create a new week customization
   * @param customization The week customization to create
   * @returns The created customization or null if failed
   */
  static async createCustomization(customization: {
    startDate: Date;
    endDate: Date;
    status: string;
    name?: string;
    link?: string;
    flexibleDates?: Date[];
  }): Promise<WeekCustomization | null> {
    // Normalize all dates upfront
    const normalizedDates = {
      startDate: normalizeToUTCDate(customization.startDate),
      endDate: normalizeToUTCDate(customization.endDate),
      status: customization.status as WeekStatus,
      name: customization.name,
      link: customization.link,
      flexibleDates: customization.flexibleDates?.map(d => normalizeToUTCDate(d))
    };

    console.log('[CalendarService] Creating customization:', {
      startDate: formatDateForDisplay(normalizedDates.startDate),
      endDate: formatDateForDisplay(normalizedDates.endDate),
      status: normalizedDates.status,
      name: normalizedDates.name,
      link: normalizedDates.link,
      flexibleDatesCount: normalizedDates.flexibleDates?.length || 0
    });
    
    try {
      // First check for overlapping customizations
      const existingCustomizations = await this.getCustomizations(
        normalizedDates.startDate,
        normalizedDates.endDate
      );
      
      const overlaps = existingCustomizations.filter(c => 
        doDateRangesOverlap(
          normalizeToUTCDate(c.startDate),
          normalizeToUTCDate(c.endDate),
          normalizedDates.startDate,
          normalizedDates.endDate
        )
      );
      
      // If there are overlaps, handle them first
      if (overlaps.length > 0) {
        console.log('[CalendarService] Found overlapping customizations:', overlaps.length);
        
        // Create operations to resolve overlaps
        const operations = this.createOverlapResolutionOperations(
          overlaps,
          normalizedDates.startDate,
          normalizedDates.endDate,
          normalizedDates.status,
          normalizedDates.name,
          normalizedDates.link,
          normalizedDates.flexibleDates
        );
        
        // Process the operations
        await this.processWeekOperations(operations);
        
        // Get the newly created customization
        const newCustomizations = await this.getCustomizations(
          normalizedDates.startDate,
          normalizedDates.endDate
        );
        
        const exactMatch = newCustomizations.find(c => 
          isSameDay(normalizeToUTCDate(c.startDate), normalizedDates.startDate) && 
          isSameDay(normalizeToUTCDate(c.endDate), normalizedDates.endDate)
        );
        
        return exactMatch || null;
      }
      
      // If no overlaps, proceed with simple creation
      const { data: newWeek, error: weekError } = await supabase
        .from('week_customizations')
        .insert(mapWeekCustomizationToRow(normalizedDates))
        .select()
        .single();

      if (weekError) throw weekError;

      // If we have flexible dates, insert them
      if (normalizedDates.flexibleDates?.length) {
        const { error: flexError } = await supabase
          .from('flexible_checkins')
          .insert(
            normalizedDates.flexibleDates.map(date => ({
              week_customization_id: newWeek.id,
              allowed_checkin_date: formatDateForDisplay(date)
            }))
          );

        if (flexError) throw flexError;
      }

      // Get the complete customization with flexible dates
      const { data: complete, error: getError } = await supabase
        .from('week_customizations')
        .select(`
          *,
          flexible_checkins (
            allowed_checkin_date
          )
        `)
        .eq('id', newWeek.id)
        .single();

      if (getError) throw getError;

      return {
        ...mapWeekCustomizationFromRow(complete),
        flexibleDates: complete.flexible_checkins?.map((fc: { allowed_checkin_date: string }) => 
          parseISO(fc.allowed_checkin_date)
        ) || []
      };
    } catch (err) {
      console.error('[CalendarService] Failed to create customization:', err);
      return null;
    }
  }

  /**
   * Update an existing week customization
   * @param id The ID of the customization to update
   * @param updates The updates to apply
   * @returns The updated customization or null if failed
   */
  static async updateCustomization(
    id: string,
    updates: Partial<WeekCustomization & { flexibleDates?: Date[]; link?: string }>
  ): Promise<WeekCustomization | null> {
    // Normalize any dates in the updates
    const normalizedUpdates = {
      ...updates,
      startDate: updates.startDate ? normalizeToUTCDate(updates.startDate) : undefined,
      endDate: updates.endDate ? normalizeToUTCDate(updates.endDate) : undefined,
      link: updates.link,
      flexibleDates: updates.flexibleDates?.map(d => normalizeToUTCDate(d))
    };
    
    console.log('[CalendarService] Updating customization:', {
      id,
      updates: {
        ...normalizedUpdates,
        startDate: normalizedUpdates.startDate ? formatDateForDisplay(normalizedUpdates.startDate) : undefined,
        endDate: normalizedUpdates.endDate ? formatDateForDisplay(normalizedUpdates.endDate) : undefined,
        name: normalizedUpdates.name,
        link: normalizedUpdates.link,
        flexibleDatesCount: normalizedUpdates.flexibleDates?.length,
        flexibleDatesProvided: normalizedUpdates.flexibleDates !== undefined
      }
    });
    
    try {
      // If dates are changing, check for overlaps
      if (normalizedUpdates.startDate || normalizedUpdates.endDate) {
        // Get the current customization
        const { data: current, error: currentError } = await supabase
          .from('week_customizations')
          .select('*')
          .eq('id', id)
          .single();
          
        if (currentError) throw currentError;
        
        // Use parseISO for dates coming directly from DB string format
        const currentStartDate = parseISO(current.start_date); 
        const currentEndDate = parseISO(current.end_date);   
        
        // Get the new date range
        const newStartDate = normalizedUpdates.startDate || currentStartDate;
        const newEndDate = normalizedUpdates.endDate || currentEndDate;
        
        // Check for overlaps with the new date range
        const existingCustomizations = await this.getCustomizations(
          newStartDate,
          newEndDate
        );
        
        const overlaps = existingCustomizations.filter(c => 
          c.id !== id && // Exclude the current customization
          doDateRangesOverlap(
            normalizeToUTCDate(c.startDate),
            normalizeToUTCDate(c.endDate),
            newStartDate,
            newEndDate
          )
        );
        
        // If there are overlaps, handle them first
        if (overlaps.length > 0) {
          console.log('[CalendarService] Found overlapping customizations for update:', overlaps.length);
          
          // Delete the current customization
          await this.deleteCustomization(id);
          
          // Create operations to resolve overlaps and create the new customization
          const operations = this.createOverlapResolutionOperations(
            overlaps,
            newStartDate,
            newEndDate,
            normalizedUpdates.status || current.status,
            normalizedUpdates.name,
            normalizedUpdates.link,
            normalizedUpdates.flexibleDates
          );
          
          // Process the operations
          await this.processWeekOperations(operations);
          
          // Get the newly created customization
          const newCustomizations = await this.getCustomizations(
            newStartDate,
            newEndDate
          );
          
          const exactMatch = newCustomizations.find(c => 
            isSameDay(normalizeToUTCDate(c.startDate), newStartDate) && 
            isSameDay(normalizeToUTCDate(c.endDate), newEndDate)
          );
          
          return exactMatch || null;
        }
      }
      
      // If no date changes or no overlaps, proceed with simple update
      const { data: updated, error: weekError } = await supabase
        .from('week_customizations')
        .update(mapWeekCustomizationToRow(normalizedUpdates))
        .eq('id', id)
        .select()
        .single();

      if (weekError) throw weekError;

      // If flexible dates are provided, update them
      if (normalizedUpdates.flexibleDates !== undefined) {
        // First delete existing dates
        console.log('[CalendarService] Updating flexible check-in dates for week:', id);
        const { error: deleteError } = await supabase
          .from('flexible_checkins')
          .delete()
          .eq('week_customization_id', id);

        if (deleteError) throw deleteError;

        // Then insert new ones if any
        if (normalizedUpdates.flexibleDates.length > 0) {
          const { error: insertError } = await supabase
            .from('flexible_checkins')
            .insert(
              normalizedUpdates.flexibleDates.map(date => ({
                week_customization_id: id,
                allowed_checkin_date: formatDateForDisplay(date)
              }))
            );

          if (insertError) throw insertError;
        }
      }

      // Get the complete updated customization
      const { data: complete, error: getError } = await supabase
        .from('week_customizations')
        .select(`
          *,
          flexible_checkins (
            allowed_checkin_date
          )
        `)
        .eq('id', id)
        .single();

      if (getError) throw getError;

      return {
        ...mapWeekCustomizationFromRow(complete),
        flexibleDates: complete.flexible_checkins?.map((fc: { allowed_checkin_date: string }) => 
          parseISO(fc.allowed_checkin_date)
        ) || []
      };
    } catch (err) {
      console.error('[CalendarService] Failed to update customization:', err);
      return null;
    }
  }

  /**
   * Delete a week customization
   * @param id The ID of the customization to delete
   * @returns True if successful, false otherwise
   */
  static async deleteCustomization(id: string): Promise<boolean> {
    console.log('[CalendarService] Deleting customization:', { id });
    const { error } = await supabase
      .from('week_customizations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[CalendarService] Error deleting customization:', error);
      return false;
    }

    return true;
  }

  /**
   * Create operations to resolve overlapping weeks
   * @param overlaps The overlapping weeks
   * @param newStartDate The start date of the new week
   * @param newEndDate The end date of the new week
   * @param status The status of the new week
   * @param name The name of the new week
   * @param flexibleDates The flexible dates of the new week
   * @returns Array of operations to resolve overlaps
   */
  private static createOverlapResolutionOperations(
    overlaps: WeekCustomization[],
    newStartDate: Date,
    newEndDate: Date,
    status?: string,
    name?: string | null,
    link?: string,
    flexibleDates?: Date[]
  ): Array<{
    type: 'create' | 'update' | 'delete';
    week: {
      id?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
      name?: string | null;
      flexibleDates?: Date[];
      link?: string;
    }
  }> {
    const operations: Array<{
      type: 'create' | 'update' | 'delete';
      week: {
        id?: string;
        startDate?: Date;
        endDate?: Date;
        status?: string;
        name?: string | null;
        flexibleDates?: Date[];
        link?: string;
      }
    }> = [];
    
    // First add the operation to create the new week
    operations.push({
      type: 'create',
      week: {
        startDate: newStartDate,
        endDate: newEndDate,
        status,
        name,
        flexibleDates,
        link
      }
    });
    
    // Then handle each overlap
    for (const overlap of overlaps) {
      const overlapStart = normalizeToUTCDate(overlap.startDate);
      const overlapEnd = normalizeToUTCDate(overlap.endDate);
      
      // Case 1: The overlap is completely contained within the new week
      if (newStartDate <= overlapStart && overlapEnd <= newEndDate) {
        operations.push({
          type: 'delete',
          week: { id: overlap.id }
        });
      }
      // Case 2: The overlap extends before the new week
      else if (overlapStart < newStartDate && overlapEnd >= newStartDate && overlapEnd <= newEndDate) {
        const newEndDate = addDays(newStartDate, -1);
        
        // Filter flexible dates that are still in the valid range
        const adjustedFlexDates = overlap.flexibleDates?.filter(date => 
          normalizeToUTCDate(date) < newStartDate
        );
        
        operations.push({
          type: 'update',
          week: {
            id: overlap.id,
            endDate: newEndDate,
            flexibleDates: adjustedFlexDates,
            link: overlap.link
          }
        });
      }
      // Case 3: The overlap extends after the new week
      else if (overlapStart >= newStartDate && overlapStart <= newEndDate && overlapEnd > newEndDate) {
        const newStartDate = addDays(newEndDate, 1);
        
        // Filter flexible dates that are still in the valid range
        const adjustedFlexDates = overlap.flexibleDates?.filter(date => 
          normalizeToUTCDate(date) > newEndDate
        );
        
        operations.push({
          type: 'update',
          week: {
            id: overlap.id,
            startDate: newStartDate,
            flexibleDates: adjustedFlexDates,
            link: overlap.link
          }
        });
      }
      // Case 4: The new week is completely contained within the overlap
      else if (overlapStart < newStartDate && overlapEnd > newEndDate) {
        // First part: from overlap start to before new start
        const firstEndDate = addDays(newStartDate, -1);
        
        // Second part: from after new end to overlap end
        const secondStartDate = addDays(newEndDate, 1);
        
        // Filter flexible dates for each part
        const firstFlexDates = overlap.flexibleDates?.filter(date => 
          normalizeToUTCDate(date) < newStartDate
        );
        
        const secondFlexDates = overlap.flexibleDates?.filter(date => 
          normalizeToUTCDate(date) > newEndDate
        );
        
        // Update the existing week to be the first part
        operations.push({
          type: 'update',
          week: {
            id: overlap.id,
            endDate: firstEndDate,
            flexibleDates: firstFlexDates,
            link: overlap.link
          }
        });
        
        // Create a new week for the second part
        operations.push({
          type: 'create',
          week: {
            startDate: secondStartDate,
            endDate: overlap.endDate,
            status: overlap.status,
            name: overlap.name,
            flexibleDates: secondFlexDates,
            link: overlap.link
          }
        });
      }
    }
    
    return operations;
  }

  /**
   * Process a batch of week operations (create, update, delete)
   * @param operations The operations to process
   * @returns True if successful, false otherwise
   */
  static async processWeekOperations(operations: Array<{
    type: 'create' | 'update' | 'delete';
    week: {
      id?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
      name?: string | null;
      flexibleDates?: Date[];
      link?: string;
    }
  }>): Promise<boolean> {
    console.log('[CalendarService] Processing week operations batch:', operations.length);
    
    try {
      // Process each operation in sequence
      for (const op of operations) {
        console.log('[CalendarService] Processing operation:', {
          type: op.type,
          weekId: op.week.id,
          startDate: op.week.startDate ? formatDateForDisplay(op.week.startDate) : undefined,
          endDate: op.week.endDate ? formatDateForDisplay(op.week.endDate) : undefined,
          name: op.week.name,
          link: op.week.link
        });
        
        // Normalize dates in the operation
        const normalizedWeek = {
          ...op.week,
          startDate: op.week.startDate ? normalizeToUTCDate(op.week.startDate) : undefined,
          endDate: op.week.endDate ? normalizeToUTCDate(op.week.endDate) : undefined,
          flexibleDates: op.week.flexibleDates?.map(d => normalizeToUTCDate(d))
        };
        
        if (op.type === 'create') {
          // Create a new week customization
          if (normalizedWeek.startDate && normalizedWeek.endDate && normalizedWeek.status) {
            await supabase
              .from('week_customizations')
              .insert(mapWeekCustomizationToRow({
                startDate: normalizedWeek.startDate,
                endDate: normalizedWeek.endDate,
                status: normalizedWeek.status as WeekStatus,
                name: normalizedWeek.name || undefined,
                link: normalizedWeek.link || undefined
              }))
              .select()
              .single()
              .then(async ({ data, error }) => {
                if (error) throw error;
                
                // If we have flexible dates, insert them
                if (normalizedWeek.flexibleDates?.length) {
                  const { error: flexError } = await supabase
                    .from('flexible_checkins')
                    .insert(
                      normalizedWeek.flexibleDates.map(date => ({
                        week_customization_id: data.id,
                        allowed_checkin_date: formatDateForDisplay(date)
                      }))
                    );
                  
                  if (flexError) throw flexError;
                }
              });
          }
        } else if (op.type === 'update' && normalizedWeek.id) {
          // Update an existing week customization
          const updateData: any = {};
          
          if (normalizedWeek.startDate) updateData.start_date = normalizedWeek.startDate.toISOString();
          if (normalizedWeek.endDate) updateData.end_date = normalizedWeek.endDate.toISOString();
          if (normalizedWeek.status) updateData.status = normalizedWeek.status;
          if (normalizedWeek.name !== undefined) updateData.name = normalizedWeek.name;
          if (normalizedWeek.link !== undefined) updateData.link = normalizedWeek.link;
          
            await supabase
              .from('week_customizations')
            .update(updateData)
            .eq('id', normalizedWeek.id)
            .then(async ({ error }) => {
              if (error) throw error;
              
              // If we have flexible dates, update them
              if (normalizedWeek.flexibleDates !== undefined) {
                // First delete existing dates
                const { error: deleteError } = await supabase
                  .from('flexible_checkins')
              .delete()
                  .eq('week_customization_id', normalizedWeek.id);
                
                if (deleteError) throw deleteError;
                
                // Then insert new ones if any
                if (normalizedWeek.flexibleDates.length > 0) {
                  const { error: insertError } = await supabase
                    .from('flexible_checkins')
                    .insert(
                      normalizedWeek.flexibleDates.map(date => ({
                        week_customization_id: normalizedWeek.id,
                        allowed_checkin_date: formatDateForDisplay(date)
                      }))
                    );
                  
                  if (insertError) throw insertError;
                }
              }
            });
        } else if (op.type === 'delete' && normalizedWeek.id) {
          // Delete a week customization
          await supabase
            .from('week_customizations')
            .delete()
            .eq('id', normalizedWeek.id);
        }
      }
      
      return true;
    } catch (err) {
      console.error('[CalendarService] Error processing week operations:', err);
      return false;
    }
  }
}
