import { supabase } from '../lib/supabase';
import type { Accommodation, Booking } from '../types';
import type { AvailabilityResult } from '../types/availability';
import type { Database } from '../types/database';
import { addDays, startOfWeek, endOfWeek } from 'date-fns';
import { convertToUTC1 } from '../utils/timezone';

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

    const availability = await this.getAvailability(checkIn, checkOut);
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
        check_in_date: startDate.toISOString().split('T')[0],
        check_out_date: endDate.toISOString().split('T')[0]
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
    const startDate = weeks[0];
    const endDate = addDays(weeks[weeks.length - 1], 7);
    
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
      query = query.or(
        `check_in.lte.${filters.endDate.toISOString()},check_out.gt.${filters.startDate.toISOString()}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async createBooking(booking: {
    accommodationId: string;
    checkIn: Date;
    checkOut: Date;
    totalPrice: number;
  }): Promise<Booking> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Validate check_out is after check_in (matching database constraint)
    if (booking.checkOut <= booking.checkIn) {
      throw new Error('Check-out date must be after check-in date');
    }

    // Validate total_price is non-negative (matching database constraint)
    if (booking.totalPrice < 0) {
      throw new Error('Total price must be non-negative');
    }

    try {
      const { data: newBooking, error } = await supabase
        .from('bookings')
        .insert({
          accommodation_id: booking.accommodationId,
          user_id: user.id,
          check_in: booking.checkIn.toISOString(),
          check_out: booking.checkOut.toISOString(),
          total_price: booking.totalPrice,
          status: 'confirmed',
          payment_intent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (error) throw error;
      if (!newBooking) throw new Error('Failed to create booking');
      
      const { data: accommodation, error: accError } = await supabase
        .from('accommodations')
        .select('title, type, image_url')
        .eq('id', newBooking.accommodation_id)
        .single();

      if (accError) throw accError;

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

    const firstWeek = weeks[0];
    const lastWeek = weeks[weeks.length - 1];
    
    const checkIn = convertToUTC1(startOfWeek(firstWeek));
    const checkOut = convertToUTC1(addDays(endOfWeek(lastWeek), 1));

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
          check_in: checkIn.toISOString(),
          check_out: checkOut.toISOString(),
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
      let currentDate = checkIn;
      while (currentDate < checkOut) {
        dates.push(currentDate.toISOString().split('T')[0]);
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

      return booking;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  async updateBooking(id: string, updates: Partial<Booking>) {
    // Validate check_out is after check_in if both are being updated
    if (updates.check_in && updates.check_out && new Date(updates.check_out) <= new Date(updates.check_in)) {
      throw new Error('Check-out date must be after check-in date');
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
