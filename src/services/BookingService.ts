import { supabase } from '../lib/supabase';
import type { Accommodation, Booking } from '../types';
import type { AvailabilityResult } from '../types/availability';
import { addDays, startOfWeek, endOfWeek, isBefore, isEqual } from 'date-fns';
import { normalizeToUTCDate, formatDateOnly } from '../utils/dates';
import { getFrontendUrl } from '../lib/environment';
import type { 
  PaymentBreakdown, 
  PaymentType, 
  CreatePendingPaymentInput, 
  UpdatePaymentAfterBookingInput 
} from '../types/payment';

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

  /**
   * Create a pending payment row before redirecting to Stripe
   */
  async createPendingPayment(payment: CreatePendingPaymentInput) {
    const { bookingId, userId, startDate, endDate, amountPaid, breakdownJson, discountCode, paymentType } = payment;
    const startISO = startDate instanceof Date ? formatDateOnly(startDate) : formatDateOnly(new Date(startDate));
    const endISO = endDate instanceof Date ? formatDateOnly(endDate) : formatDateOnly(new Date(endDate));
    
    const { data, error } = await supabase
      .from('payments')
      .insert({
        booking_id: bookingId ?? null,
        user_id: userId,
        start_date: startISO,
        end_date: endISO,
        amount_paid: amountPaid,
        breakdown_json: breakdownJson,
        discount_code: discountCode || null,
        payment_type: paymentType,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) {
      console.error('[BookingService] Error creating pending payment:', error);
      throw error;
    }
    
    return data;
  }

  /**
   * Update a payment row after Stripe payment confirmation
   */
  async markPaymentAsPaid(paymentId: string, stripePaymentId: string, breakdownJson?: any) {
    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        stripe_payment_id: stripePaymentId,
        breakdown_json: breakdownJson,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select('*')
      .single();
    if (error) {
      console.error('[BookingService] Error updating payment to paid:', error);
      throw error;
    }
    return data;
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
    accommodationPrice?: number;
    foodContribution?: number;
    seasonalAdjustment?: number;
    seasonalDiscountPercent?: number; // NEW: Seasonal discount percentage
    durationDiscountPercent?: number;
    discountAmount?: number;
    discountCodePercent?: number;
    discountCodeAppliesTo?: string; // NEW: What the discount code applies to (total, food_facilities, etc.)
    discountCodeAmount?: number; // NEW: Exact discount code amount to avoid rounding issues
    accommodationPricePaid?: number; // NEW: Actual accommodation amount paid
    accommodationPriceAfterSeasonalDuration?: number; // NEW: After seasonal/duration but before codes
    subtotalAfterDiscountCode?: number; // NEW: After discount code but before credits
    paymentRowId?: string; // NEW: Optionally link to a pending payment row
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
          accommodation_price: booking.accommodationPrice ?? null,
          food_contribution: booking.foodContribution ?? null,
          seasonal_adjustment: booking.seasonalAdjustment ?? null,
          seasonal_discount_percent: booking.seasonalDiscountPercent ?? null, // NEW field
          duration_discount_percent: booking.durationDiscountPercent ?? null,
          discount_amount: booking.discountAmount ?? null,
          discount_code_percent: booking.discountCodePercent ?? null,
          discount_code_applies_to: booking.discountCodeAppliesTo ?? null, // NEW field
          accommodation_price_paid: booking.accommodationPricePaid ?? null, // NEW field
          accommodation_price_after_seasonal_duration: booking.accommodationPriceAfterSeasonalDuration ?? null, // NEW field
          subtotal_after_discount_code: booking.subtotalAfterDiscountCode ?? null, // NEW field
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

      // After booking is created, if paymentRowId is provided, mark payment as paid
      if (booking.paymentRowId && booking.paymentIntentId) {
        await this.markPaymentAsPaid(booking.paymentRowId, booking.paymentIntentId, {
          accommodationPrice: booking.accommodationPrice,
          foodContribution: booking.foodContribution,
          seasonalAdjustment: booking.seasonalAdjustment,
          seasonalDiscountPercent: booking.seasonalDiscountPercent,
          durationDiscountPercent: booking.durationDiscountPercent,
          discountAmount: booking.discountAmount,
          discountCodePercent: booking.discountCodePercent,
          discountCodeAppliesTo: booking.discountCodeAppliesTo,
          accommodationPricePaid: booking.accommodationPricePaid,
          accommodationPriceAfterSeasonalDuration: booking.accommodationPriceAfterSeasonalDuration,
          subtotalAfterDiscountCode: booking.subtotalAfterDiscountCode,
        });
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
            image_url,
            base_price
          ),
          payments:payments!booking_id (
            amount_paid,
            status
          )
        `)
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to calculate payment totals
      const transformedData = data?.map(booking => {
        // Sum all paid payments for this booking
        const totalAmountPaid = booking.payments
          ?.filter((payment: any) => payment.status === 'paid')
          ?.reduce((sum: number, payment: any) => sum + Number(payment.amount_paid), 0) || 0;
        
        return {
          ...booking,
          total_amount_paid: totalAmountPaid
        };
      });

      console.log('[BookingService] Fetched user bookings with payment totals:', transformedData);
      return transformedData;
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      throw error;
    }
  }

  async checkBookingByPaymentIntent(paymentIntentId: string): Promise<boolean> {
    try {
      console.log('[BookingService] Checking if booking exists for payment intent:', paymentIntentId);
      
      const { data, error } = await supabase
        .from('bookings')
        .select('id')
        .eq('payment_intent_id', paymentIntentId)
        .single();

      if (error) {
        // If error is "no rows returned", that's fine - it means no booking exists
        if (error.code === 'PGRST116') {
          console.log('[BookingService] No booking found for payment intent:', paymentIntentId);
          return false;
        }
        console.error('[BookingService] Error checking booking by payment intent:', error);
        throw error;
      }

      console.log('[BookingService] Booking found for payment intent:', paymentIntentId, 'with ID:', data?.id);
      return !!data;
    } catch (error) {
      console.error('[BookingService] Error in checkBookingByPaymentIntent:', error);
      // In case of error, return false to avoid false positives
      return false;
    }
  }

  /**
   * Update a pending payment row after booking creation
   */
  async updatePaymentAfterBooking(input: UpdatePaymentAfterBookingInput) {
    const { paymentRowId, bookingId, stripePaymentId } = input;
    console.log('[BookingService] [DEBUG] updatePaymentAfterBooking called with:', {
      paymentRowId,
      bookingId,
      stripePaymentId
    });
    const { data, error } = await supabase
      .from('payments')
      .update({
        booking_id: bookingId,
        status: 'paid',
        stripe_payment_id: stripePaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentRowId)
      .select('*')
      .single();
    if (error) {
      console.error('[BookingService] [DEBUG] Error updating payment after booking:', error);
      throw error;
    }
    console.log('[BookingService] [DEBUG] Payment row updated successfully:', data);
    return data;
  }

  /**
   * Extend an existing booking
   */
  async extendBooking(extension: {
    bookingId: string;
    newCheckOut: string; // YYYY-MM-DD format
    extensionPrice: number; // Full extension value (for booking total)
    paymentAmount?: number; // Actual amount paid after credits (for payment record)
    paymentIntentId: string;
    appliedDiscountCode?: string;
    discountCodePercent?: number;
    discountCodeAppliesTo?: string;
    discountAmount?: number;
    discountCodeAmount?: number; // NEW: Exact discount code amount to avoid rounding issues
    accommodationPrice?: number;
    accommodationOriginalPrice?: number; // NEW: Original accommodation price before discounts
    foodContribution?: number;
    creditsUsed?: number; // NEW: Credits used for extension
    seasonalDiscountPercent?: number;
    durationDiscountPercent?: number;
    extensionWeeks?: number;
  }) {
    console.log('[BookingService] Extending booking:', extension);
    console.log('[BookingService] CREDITS DEBUG - Extension called with credits data:', {
      extensionPrice: extension.extensionPrice,
      creditsUsed: extension.creditsUsed,
      hasCredits: extension.creditsUsed && extension.creditsUsed > 0,
      paymentIntentId: extension.paymentIntentId
    });

    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // First, get the current booking to validate and calculate dates
      const { data: currentBooking, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', extension.bookingId)
        .eq('user_id', user.id) // Ensure user owns this booking
        .single();

      if (fetchError || !currentBooking) {
        console.error('[BookingService] Error fetching booking for extension:', fetchError);
        console.error('[BookingService] CREDITS DEBUG - Booking fetch failed:', {
          bookingId: extension.bookingId,
          userId: user.id,
          fetchError,
          hasBooking: !!currentBooking
        });
        throw new Error('Booking not found or unauthorized');
      }

      console.log('[BookingService] CREDITS DEBUG - Successfully fetched booking for extension:', {
        bookingId: currentBooking.id,
        userId: currentBooking.user_id,
        currentCheckOut: currentBooking.check_out,
        currentTotalPrice: currentBooking.total_price,
        bookingStatus: currentBooking.status
      });

      // Parse the current checkout date and new checkout date
      const currentCheckOut = new Date(currentBooking.check_out);
      const newCheckOut = new Date(extension.newCheckOut);
      
      // Validate that the new checkout is after the current checkout
      if (newCheckOut <= currentCheckOut) {
        throw new Error('New checkout date must be after current checkout date');
      }

      console.log('[BookingService] Extension validation passed:', {
        bookingId: extension.bookingId,
        currentCheckOut: currentCheckOut.toISOString(),
        newCheckOut: newCheckOut.toISOString(),
        extensionPrice: extension.extensionPrice
      });

      console.log('[BookingService] FIXED: Using original accommodation price directly - no more reverse calculations');

      // Use the original accommodation price directly (no more reverse calculations)
      const accommodationOriginal = extension.accommodationOriginalPrice || extension.accommodationPrice || 0;
      
      // Create payment record for the extension
      // FIXED: Using original accommodation price directly - much cleaner!
      const paymentBreakdown: PaymentBreakdown = {
        accommodation: extension.accommodationPrice || 0, // Discounted accommodation price (after seasonal/duration discounts)
        food_facilities: extension.foodContribution || 0,
        accommodation_original: Math.round(accommodationOriginal), // Original price before discounts
        duration_discount_percent: (extension.durationDiscountPercent || 0), // Already in decimal format (0.16 for 16%)
        seasonal_discount_percent: (extension.seasonalDiscountPercent || 0), // Already in decimal format (0.16 for 16%)
        discount_code: extension.appliedDiscountCode || null,
        discount_code_percent: extension.discountCodePercent || null, // Should be decimal (0.5 for 50%)
        discount_code_applies_to: extension.discountCodeAppliesTo as any || null,
        discount_code_amount: extension.discountCodeAmount || 0, // Already rounded in MyBookings.tsx
        credits_used: extension.creditsUsed || 0, // NEW: Credits used for extension
        subtotal_before_discounts: (extension.accommodationPrice || 0) + (extension.foodContribution || 0), // Use discounted accommodation price
        total_after_discounts: Math.round(extension.extensionPrice) // Round to match Stripe amount
      };

      // DETAILED LOGGING: Verify all payment breakdown values are accurate
      console.log('[BookingService] ===== EXTENSION PAYMENT BREAKDOWN VERIFICATION =====');
      console.log('[BookingService] Input values received:', {
        extensionPrice: extension.extensionPrice,
        accommodationPrice: extension.accommodationPrice,
        accommodationOriginalPrice: extension.accommodationOriginalPrice,
        foodContribution: extension.foodContribution,
        seasonalDiscountPercent: extension.seasonalDiscountPercent, // For extension period only
        durationDiscountPercent: extension.durationDiscountPercent, // For total stay (original + extension)
        appliedDiscountCode: extension.appliedDiscountCode,
        discountCodePercent: extension.discountCodePercent,
        discountCodeAppliesTo: extension.discountCodeAppliesTo,
        discountCodeAmount: extension.discountCodeAmount // FIXED: Log exact discount code amount
      });
      console.log('[BookingService] Calculated values:', {
        accommodationOriginal: accommodationOriginal,
        roundedAccommodationOriginal: Math.round(accommodationOriginal),
        seasonalDiscountDecimal: (extension.seasonalDiscountPercent || 0) / 100,
        durationDiscountDecimal: (extension.durationDiscountPercent || 0) / 100,
        discountCodeDecimal: extension.discountCodePercent,
        subtotalBeforeDiscounts: (extension.accommodationPrice || 0) + (extension.foodContribution || 0),
        totalAfterDiscounts: Math.round(extension.extensionPrice)
      });
      console.log('[BookingService] FIXED: No more reverse calculations - using original price directly!');
      console.log('[BookingService] Final payment breakdown object:', JSON.stringify(paymentBreakdown, null, 2));
      console.log('[BookingService] Verification checks:', {
        accommodationIsDiscountedPrice: paymentBreakdown.accommodation === (extension.accommodationPrice || 0),
        accommodationOriginalIsOriginalPrice: paymentBreakdown.accommodation_original === Math.round(accommodationOriginal),
        seasonalDiscountIsDecimal: paymentBreakdown.seasonal_discount_percent === (extension.seasonalDiscountPercent || 0) / 100,
        durationDiscountIsDecimal: paymentBreakdown.duration_discount_percent === (extension.durationDiscountPercent || 0) / 100,
        subtotalCalculation: paymentBreakdown.subtotal_before_discounts === (extension.accommodationPrice || 0) + (extension.foodContribution || 0),
        totalMatchesExtensionPrice: paymentBreakdown.total_after_discounts === Math.round(extension.extensionPrice),
        originalPriceSource: extension.accommodationOriginalPrice ? 'directly provided' : 'fallback to accommodationPrice'
      });
      console.log('[BookingService] ===== END VERIFICATION =====');

      const actualPaymentAmount = extension.paymentAmount ?? extension.extensionPrice;
      
      console.log('[BookingService] CREDITS DEBUG - About to create payment record with breakdown:', {
        creditsUsed: paymentBreakdown.credits_used,
        totalAfterDiscounts: paymentBreakdown.total_after_discounts,
        extensionPrice: extension.extensionPrice,
        paymentAmount: extension.paymentAmount,
        actualPaymentAmount,
        amountThatWillBeCharged: actualPaymentAmount
      });

      const { data: paymentRecord, error: paymentError } = await supabase
        .from('payments')
        .insert({
          booking_id: extension.bookingId,
          user_id: user.id,
          start_date: formatDateOnly(currentCheckOut), // Extension starts where original ends
          end_date: extension.newCheckOut,
          amount_paid: actualPaymentAmount,
          breakdown_json: paymentBreakdown,
          discount_code: extension.appliedDiscountCode || null,
          payment_type: 'extension' as PaymentType,
          stripe_payment_id: extension.paymentIntentId,
          status: 'paid',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (paymentError) {
        console.error('[BookingService] Error creating extension donation:', paymentError);
        console.error('[BookingService] CREDITS DEBUG - Payment record creation failed:', {
          creditsUsed: extension.creditsUsed,
          extensionPrice: extension.extensionPrice,
          error: paymentError
        });
        throw new Error('Failed to create payment record for extension');
      }

      console.log('[BookingService] CREDITS DEBUG - Payment record created successfully:', {
        paymentId: paymentRecord.id,
        amountPaid: paymentRecord.amount_paid,
        creditsInBreakdown: paymentRecord.breakdown_json?.credits_used
      });

      // Update the booking with new checkout date and total price
      const newTotalPrice = currentBooking.total_price + extension.extensionPrice;
      
      console.log('[BookingService] CREDITS DEBUG - About to update booking:', {
        bookingId: extension.bookingId,
        currentBookingId: currentBooking.id,
        currentTotalPrice: currentBooking.total_price,
        extensionPrice: extension.extensionPrice,
        newTotalPrice,
        newCheckOut: extension.newCheckOut,
        currentCheckOut: currentBooking.check_out
      });

      // BUG ANALYSIS: Check current credits_used value before update
      console.log('[BookingService] CREDITS DEBUG - BEFORE UPDATE:', {
        currentCreditsUsed: currentBooking.credits_used,
        extensionCreditsUsed: extension.creditsUsed,
        shouldAccumulateCredits: extension.creditsUsed && extension.creditsUsed > 0,
        totalCreditsUsedAfterExtension: (currentBooking.credits_used || 0) + (extension.creditsUsed || 0)
      });

      // Get user's current credit balance BEFORE the update
      const { data: userBeforeUpdate, error: userError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();

      console.log('[BookingService] CREDITS DEBUG - User credits BEFORE update:', {
        userCredits: userBeforeUpdate?.credits,
        userError,
        creditsToDeduct: extension.creditsUsed
      });
      
      // First, let's verify the booking still exists before updating
      const { data: verifyBooking, error: verifyError } = await supabase
        .from('bookings')
        .select('id, user_id, total_price, check_out, status, credits_used')
        .eq('id', extension.bookingId)
        .single();

      console.log('[BookingService] CREDITS DEBUG - Booking verification before update:', {
        verifyError,
        foundBooking: !!verifyBooking,
        bookingData: verifyBooking
      });

      if (verifyError || !verifyBooking) {
        console.error('[BookingService] CREDITS DEBUG - Booking not found for update:', {
          bookingId: extension.bookingId,
          verifyError
        });
        throw new Error(`Booking not found for update: ${extension.bookingId}`);
      }

      // BUG FIX: Include credits_used in the update to trigger credit deduction
      const newCreditsUsed = (currentBooking.credits_used || 0) + (extension.creditsUsed || 0);
      
      console.log('[BookingService] CREDITS DEBUG - Preparing booking update with credits:', {
        currentCreditsUsed: currentBooking.credits_used,
        extensionCreditsUsed: extension.creditsUsed,
        newCreditsUsed,
        willUpdateCreditsField: extension.creditsUsed && extension.creditsUsed > 0
      });

      const updatePayload = {
        check_out: extension.newCheckOut,
        total_price: newTotalPrice,
        ...(extension.creditsUsed && extension.creditsUsed > 0 && {
          credits_used: newCreditsUsed
        }),
        updated_at: new Date().toISOString()
      };

      console.log('[BookingService] CREDITS DEBUG - Final update payload:', updatePayload);

      const { data: updatedBooking, error: updateError } = await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('id', extension.bookingId)
        .select('*')
        .single();

      console.log('[BookingService] CREDITS DEBUG - Booking update result:', {
        success: !updateError,
        error: updateError,
        updatedBookingId: updatedBooking?.id,
        updatedTotalPrice: updatedBooking?.total_price,
        updatedCreditsUsed: updatedBooking?.credits_used,
        updatePayload,
        whereClause: { id: extension.bookingId }
      });

      // Check user's credit balance AFTER the update to see if it changed
      const { data: userAfterUpdate, error: userAfterError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();

      console.log('[BookingService] CREDITS DEBUG - User credits AFTER update:', {
        userCreditsAfter: userAfterUpdate?.credits,
        userCreditsBefore: userBeforeUpdate?.credits,
        creditChange: userBeforeUpdate?.credits ? (userAfterUpdate?.credits || 0) - userBeforeUpdate.credits : null,
        expectedCreditChange: extension.creditsUsed ? -extension.creditsUsed : 0,
        creditsWereDeducted: userBeforeUpdate?.credits && userAfterUpdate?.credits && (userAfterUpdate.credits < userBeforeUpdate.credits),
        userAfterError
      });

      // If update failed, let's try a simpler query to understand why
      if (updateError) {
        console.log('[BookingService] CREDITS DEBUG - Update failed, checking booking state...');
        
        const { data: postFailureCheck, error: postFailureError } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', extension.bookingId);
          
        console.log('[BookingService] CREDITS DEBUG - Post-failure booking check:', {
          postFailureError,
          bookingCount: postFailureCheck?.length || 0,
          bookingData: postFailureCheck
        });
      }

      if (updateError) {
        console.error('[BookingService] Error updating booking for extension:', updateError);
        throw new Error('Failed to update booking with extension');
      }

      // Update availability calendar for the extension period
      const extensionStartDate = new Date(currentCheckOut.getTime() + 24 * 60 * 60 * 1000); // Start day after current checkout
      const extensionEndDate = new Date(newCheckOut.getTime()); // Until new checkout (exclusive)
      
      // Generate dates for the extension period
      const dates = [];
      for (let d = new Date(extensionStartDate); d < extensionEndDate; d.setDate(d.getDate() + 1)) {
        dates.push(formatDateOnly(new Date(d)));
      }

      if (dates.length > 0) {
        const { error: availabilityError } = await supabase
          .from('availability')
          .upsert(
            dates.map(date => ({
              accommodation_id: currentBooking.accommodation_id,
              date,
              status: 'BOOKED'
            })),
            { onConflict: 'accommodation_id,date' }
          );

        if (availabilityError) {
          console.warn('[BookingService] Warning: Failed to update availability for extension:', availabilityError);
          // Don't throw here - the booking extension still succeeded
        }
      }

      console.log('[BookingService] Booking extension completed successfully:', {
        bookingId: extension.bookingId,
        paymentId: paymentRecord.id,
        oldCheckOut: currentCheckOut.toISOString(),
        newCheckOut: extension.newCheckOut,
        extensionPrice: extension.extensionPrice,
        newTotalPrice
      });

      console.log('[BookingService] CREDITS DEBUG - Extension process completed successfully with credits:', {
        creditsUsed: extension.creditsUsed,
        finalBookingTotalPrice: newTotalPrice,
        paymentRecordAmount: paymentRecord.amount_paid,
        success: true
      });

      // Fetch accommodation details for response
      const { data: accommodation, error: accError } = await supabase
        .from('accommodations')
        .select('title, type, image_url, base_price')
        .eq('id', currentBooking.accommodation_id)
        .single();

      if (accError) {
        console.warn('[BookingService] Warning: Could not fetch accommodation details:', accError);
      }

      return {
        booking: { ...updatedBooking, accommodation },
        payment: paymentRecord
      };

    } catch (error) {
      console.error('[BookingService] Error in extendBooking:', error);
      throw error;
    }
  }
}

export const bookingService = BookingService.getInstance();
