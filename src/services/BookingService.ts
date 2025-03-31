import { supabase } from '../lib/supabase';
import type { Accommodation, Booking } from '../types';
import type { AvailabilityResult } from '../types/availability';
import type { Database } from '../types/database';
import { addDays, startOfWeek, endOfWeek, isBefore, isEqual } from 'date-fns';
import { normalizeToUTCDate, safeParseDate, formatDateOnly } from '../utils/dates';
import { convertToUTC1 } from '../utils/timezone';
import { getFrontendUrl } from '../lib/environment';

type AccommodationType = Database['public']['Tables']['accommodations']['Row'];

class BookingService {
  private static instance: BookingService;

  private constructor() {}

  public static getInstance(): BookingService {
    if (!BookingService.instance) {
      BookingService.instance = new BookingService();
    }
    return BookingService.instance;
  }

  async getAccommodations() {
    console.log('[BookingService] Fetching accommodations');
    const { data, error } = await supabase
      .from('accommodations')
      .select(`
        id,
        title,
        base_price,
        type,
        capacity,
        has_wifi,
        has_electricity,
        image_url,
        is_unlimited
      `)
      .order('title');

    if (error) {
      console.error('[BookingService] Error fetching accommodations:', error);
      throw error;
    }

    console.log('[BookingService] Received accommodations:', data);
    return data as AccommodationType[];
  }

  async updateAccommodation(id: string, updates: Partial<AccommodationType>) {
    console.log('[BookingService] Updating accommodation:', { id, updates });
    const { data, error } = await supabase
      .from('accommodations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[BookingService] Error updating accommodation:', error);
      throw error;
    }

    console.log('[BookingService] Updated accommodation:', data);
    return data;
  }

  async checkSpecificAvailability(
    accommodationId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<boolean> {
    console.log('[BookingService] Checking specific availability:', {
      accommodationId,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString()
    });

    // Normalize dates to UTC
    const normalizedCheckIn = normalizeToUTCDate(checkIn);
    const normalizedCheckOut = normalizeToUTCDate(checkOut);

    const availability = await this.getAvailability(normalizedCheckIn, normalizedCheckOut);
    const result = availability.find(a => a.accommodation_id === accommodationId);

    console.log('[BookingService] Specific availability result:', {
      accommodationId,
      result,
      isAvailable: result?.is_available ?? false
    });

    return result?.is_available ?? false;
  }

  async getAvailability(startDate: Date, endDate: Date): Promise<AvailabilityResult[]> {
    console.log('[BookingService] Getting availability:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    const { data, error } = await supabase
      .rpc('get_accommodation_availability', {
        check_in_date: formatDateOnly(startDate),
        check_out_date: formatDateOnly(endDate)
      });

    if (error) {
      console.error('[BookingService] Error getting availability:', error);
      throw error;
    }

    console.log('[BookingService] Availability results:', data);
    return data as AvailabilityResult[];
  }

  async checkWeekAvailability(
    accommodationId: string,
    weeks: Date[]
  ): Promise<boolean> {
    console.log('[BookingService] Checking week availability:', {
      accommodationId,
      weeks: weeks.map(w => w.toISOString())
    });

    if (weeks.length === 0) {
      console.log('[BookingService] No weeks selected, returning true');
      return true;
    }
    
    // Get the earliest and latest dates from the weeks array
    // Normalize the week dates to UTC
    const normalizedWeeks = weeks.map(w => normalizeToUTCDate(w));
    const startDate = normalizedWeeks[0];
    const endDate = addDays(normalizedWeeks[normalizedWeeks.length - 1], 7);
    
    const availability = await this.getAvailability(startDate, endDate);
    const result = availability.find(a => a.accommodation_id === accommodationId);

    console.log('[BookingService] Week availability result:', {
      accommodationId,
      result,
      isAvailable: result?.is_available ?? false
    });

    return result?.is_available ?? false;
  }

  async getBookings(filters: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
    userId?: string;
  }) {
    let query = supabase
      .from('bookings')
      .select(`
        id,
        accommodation_id,
        check_in,
        check_out,
        status,
        total_price,
        user_id
      `);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.startDate && filters.endDate) {
      // Normalize dates and format properly for the query
      const formattedStartDate = formatDateOnly(normalizeToUTCDate(filters.startDate));
      const formattedEndDate = formatDateOnly(normalizeToUTCDate(filters.endDate));
      
      query = query.or(
        `check_in.lte.${formattedEndDate},check_out.gt.${formattedStartDate}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  async createBooking(booking: {
    accommodationId: string;
    checkIn: Date | string;
    checkOut: Date | string;
    totalPrice: number;
    isAdmin?: boolean;
  }): Promise<Booking> {
    console.log('[BookingService] Creating booking with data:', {
      ...booking,
      checkInType: booking.checkIn instanceof Date ? 'Date' : 'string',
      checkOutType: booking.checkOut instanceof Date ? 'Date' : 'string'
    });

    const user = await this.getCurrentUser();
    console.log('[BookingService] Current user:', user?.id);
    
    if (!user && !booking.isAdmin) {
      console.error('[BookingService] No authenticated user found');
      throw new Error('User not authenticated');
    }

    // Validate total_price is non-negative (matching database constraint)
    if (booking.totalPrice < 0) {
      console.error('[BookingService] Invalid total price:', booking.totalPrice);
      throw new Error('Total price must be non-negative');
    }

    try {
      // Safely parse and normalize dates
      const checkInDate = booking.checkIn instanceof Date 
        ? normalizeToUTCDate(booking.checkIn) 
        : safeParseDate(booking.checkIn as string);
      console.log(`[BookingService] Processed checkInDate object: ${checkInDate.toISOString()}`);
      
      const checkOutDate = booking.checkOut instanceof Date 
        ? normalizeToUTCDate(booking.checkOut) 
        : safeParseDate(booking.checkOut as string);
      console.log(`[BookingService] Processed checkOutDate object: ${checkOutDate.toISOString()}`);
      
      // Format as YYYY-MM-DD
      const checkInISO = formatDateOnly(checkInDate);
      const checkOutISO = formatDateOnly(checkOutDate);
      
      console.log('[BookingService] Inserting booking with processed dates:', {
        originalCheckIn: booking.checkIn instanceof Date ? booking.checkIn.toISOString() : booking.checkIn,
        originalCheckOut: booking.checkOut instanceof Date ? booking.checkOut.toISOString() : booking.checkOut,
        processedCheckIn: checkInISO,
        processedCheckOut: checkOutISO,
        accommodationId: booking.accommodationId,
        userId: user?.id || 'admin',
        totalPrice: booking.totalPrice
      });

      const { data: newBooking, error } = await supabase
        .from('bookings')
        .insert({
          accommodation_id: booking.accommodationId,
          user_id: user?.id || 'admin',
          check_in: checkInISO,
          check_out: checkOutISO,
          total_price: booking.totalPrice,
          status: 'confirmed',
          payment_intent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (error) {
        console.error('[BookingService] Error creating booking:', error);
        throw error;
      }
      if (!newBooking) {
        console.error('[BookingService] No booking returned after creation');
        throw new Error('Failed to create booking');
      }
      
      console.log('[BookingService] Successfully created booking:', newBooking);

      const { data: accommodation, error: accError } = await supabase
        .from('accommodations')
        .select('title, type, image_url, capacity')
        .eq('id', newBooking.accommodation_id)
        .single();

      if (accError) {
        console.warn('[BookingService] Error fetching accommodation details:', accError);
      }

      // Send booking confirmation email
      if (user?.email) {
        console.log('[BookingService] Sending booking confirmation email to:', user.email);
        const { error: emailError } = await supabase.functions.invoke('send-booking-confirmation', {
          body: { 
            email: user.email,
            bookingId: newBooking.id,
            checkIn: checkInISO,
            checkOut: checkOutISO,
            accommodation: accommodation?.title || 'Accommodation',
            totalPrice: booking.totalPrice,
            frontendUrl: getFrontendUrl()
          }
        });
        console.log('[BookingService] Email sending result:', { emailError });
      }

      console.log('[BookingService] Returning booking with accommodation:', {
        booking: newBooking,
        accommodation
      });
      return { ...newBooking, accommodation };
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  async getUserBookings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          accommodation:accommodations (
            title,
            type,
            image_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      throw error;
    }
  }

  async createWeeklyBooking(
    accommodationId: string,
    weeks: Date[],
    totalPrice: number
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Normalize dates to UTC
    const normalizedWeeks = weeks.map(w => normalizeToUTCDate(w));
    const firstWeek = normalizedWeeks[0];
    const lastWeek = normalizedWeeks[normalizedWeeks.length - 1];
    
    // Format as YYYY-MM-DD
    const checkIn = formatDateOnly(startOfWeek(firstWeek));
    const checkOut = formatDateOnly(addDays(endOfWeek(lastWeek), 1));

    console.log('[BookingService] Creating weekly booking:', {
      accommodationId,
      weeksCount: normalizedWeeks.length,
      checkIn,
      checkOut,
      totalPrice
    });

    // Validate total_price is non-negative (matching database constraint)
    if (totalPrice < 0) {
      throw new Error('Total price must be non-negative');
    }

    try {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          accommodation_id: accommodationId,
          user_id: user.id,
          check_in: checkIn,
          check_out: checkOut,
          total_price: totalPrice,
          status: 'confirmed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Mark dates as booked in availability
      const dates = [];
      let currentDate = safeParseDate(checkIn);
      const endDate = safeParseDate(checkOut);
      
      while (isBefore(currentDate, endDate)) {
        dates.push(formatDateOnly(currentDate));
        currentDate = addDays(currentDate, 1);
      }

      const { error: availabilityError } = await supabase
        .from('availability')
        .insert(
          dates.map(date => ({
            accommodation_id: accommodationId,
            date,
            status: 'BOOKED'
          }))
        );

      if (availabilityError) throw availabilityError;

      // Get accommodation details for email
      const { data: accommodation } = await supabase
        .from('accommodations')
        .select('title, capacity')
        .eq('id', accommodationId)
        .single();

      // Send booking confirmation email
      if (user.email) {
        console.log('[BookingService] Sending booking confirmation email to:', user.email);
        const { error: emailError } = await supabase.functions.invoke('send-booking-confirmation', {
          body: { 
            email: user.email,
            bookingId: booking.id,
            checkIn: checkIn,
            checkOut: checkOut,
            accommodation: accommodation?.title || 'Accommodation',
            totalPrice: totalPrice,
            frontendUrl: getFrontendUrl()
          }
        });
        console.log('[BookingService] Email sending result:', { emailError });
      }

      return booking;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  async updateBooking(id: string, updates: Partial<Booking>) {
    // Validate check_out is after check_in if both are being updated
    if (updates.check_in && updates.check_out) {
      const checkInDate = safeParseDate(updates.check_in);
      const checkOutDate = safeParseDate(updates.check_out);
        if (isEqual(checkInDate, checkOutDate) || isBefore(checkOutDate, checkInDate)) {
        throw new Error('Check-out date must be after check-in date');
      }
    }

    // Validate total_price is non-negative if being updated
    if (updates.total_price !== undefined && updates.total_price < 0) {
      throw new Error('Total price must be non-negative');
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async cancelBooking(id: string) {
    return this.updateBooking(id, { status: 'cancelled' });
  }
}

export const bookingService = BookingService.getInstance();
