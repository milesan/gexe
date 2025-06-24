import { supabase } from '../lib/supabase';
import type { Accommodation, Booking } from '../types';
import type { AvailabilityResult } from '../types/availability';
import { addDays, startOfWeek, endOfWeek, isBefore, isEqual } from 'date-fns';
import { normalizeToUTCDate, formatDateOnly } from '../utils/dates';
import { getFrontendUrl } from '../lib/environment';

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
    console.log('[BookingService] Fetching accommodations with images');
    
    // Fetch accommodations
    const { data: accommodationsData, error: accommodationsError } = await supabase
      .from('accommodations')
      .select('*')
      .order('title');

    if (accommodationsError) {
      console.error('[BookingService] Error fetching accommodations:', accommodationsError);
      throw accommodationsError;
    }

    // Fetch all images for all accommodations
    const { data: imagesData, error: imagesError } = await supabase
      .from('accommodation_images')
      .select('*')
      .order('display_order');

    if (imagesError) {
      console.error('[BookingService] Error fetching accommodation images:', imagesError);
      // Don't throw error - just continue without new images (backward compatibility)
      console.warn('[BookingService] Continuing without new images, falling back to image_url field');
    }

    // Combine accommodations with their images
    const accommodationsWithImages = (accommodationsData || []).map(acc => {
      const accommodationImages = (imagesData || []).filter(img => img.accommodation_id === acc.id);
      return {
        ...acc,
        images: accommodationImages
      };
    });

    console.log('[BookingService] Received accommodations with images:', accommodationsWithImages);
    return accommodationsWithImages as Accommodation[];
  }

  async updateAccommodation(id: string, updates: Partial<Accommodation>) {
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
    appliedDiscountCode?: string;
    creditsUsed?: number;
    paymentIntentId?: string;
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

    // Validate credits_used is non-negative
    if (booking.creditsUsed !== undefined && booking.creditsUsed < 0) {
      console.error('[BookingService] Invalid credits used:', booking.creditsUsed);
      throw new Error('Credits used must be non-negative');
    }

    try {
      // Safely parse and normalize dates
      const checkInDate = booking.checkIn instanceof Date 
        ? normalizeToUTCDate(booking.checkIn) 
        : normalizeToUTCDate(booking.checkIn as string);
      console.log(`[BookingService] Processed checkInDate object: ${checkInDate.toISOString()}`);
      
      const checkOutDate = booking.checkOut instanceof Date 
        ? normalizeToUTCDate(booking.checkOut) 
        : normalizeToUTCDate(booking.checkOut as string);
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
        totalPrice: booking.totalPrice,
        appliedDiscountCode: booking.appliedDiscountCode,
        creditsUsed: booking.creditsUsed || 0
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
          payment_intent_id: booking.paymentIntentId || null,
          applied_discount_code: booking.appliedDiscountCode || null,
          credits_used: booking.creditsUsed || 0,
          accommodation_price: booking.accommodationPrice || null,
          food_contribution: booking.foodContribution || null,
          seasonal_adjustment: booking.seasonalAdjustment || null,
          duration_discount_percent: booking.durationDiscountPercent || null,
          discount_amount: booking.discountAmount || null,
          discount_code_percent: booking.discountCodePercent || null,
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

      // Credits are automatically handled by database trigger

      const { data: accommodation, error: accError } = await supabase
        .from('accommodations')
        .select('title, type, image_url, inventory')
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
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      throw error;
    }
  }
}

export const bookingService = BookingService.getInstance();
