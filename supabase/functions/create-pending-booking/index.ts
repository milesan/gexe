import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { normalizeToUTCDate, formatDateOnly } from '../_shared/date_utils.ts';

console.log('Create Pending Booking function booting up...');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header.');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) {
      throw new Error('Authentication failed or user not found.');
    }

    const userId = user.id;
    const userEmail = user.email;
    console.log(`[CreatePendingBooking] Authenticated user: ${userId}`);

    // Parse booking details
    const bookingPayload = await req.json();
    console.log('[CreatePendingBooking] Received payload:', bookingPayload);

    const {
      accommodationId,
      checkIn,
      checkOut,
      totalPrice,
      appliedDiscountCode,
      discountAmount,
      creditsUsed,
      foodContribution
    } = bookingPayload;

    // Validate required fields
    if (!accommodationId || !checkIn || !checkOut || totalPrice === undefined) {
      throw new Error('Missing required booking fields');
    }

    // Format dates
    const checkInISO = formatDateOnly(normalizeToUTCDate(new Date(checkIn)));
    const checkOutISO = formatDateOnly(normalizeToUTCDate(new Date(checkOut)));

    // Check availability one more time
    console.log(`[CreatePendingBooking] Checking availability for ${accommodationId}`);
    const { data: availabilityResults, error: availabilityError } = await supabaseAdmin
      .rpc('get_accommodation_availability', {
        check_in_date: checkInISO,
        check_out_date: checkOutISO,
      });

    if (availabilityError) {
      throw new Error(`Availability check failed: ${availabilityError.message}`);
    }

    const accommodationAvailability = (availabilityResults as any[])?.find(
      (a) => a.accommodation_id === accommodationId
    );

    if (!accommodationAvailability?.is_available && !accommodationAvailability?.is_unlimited) {
      throw new Error('Accommodation is no longer available for the selected dates');
    }

    // Create pending booking
    const pendingBooking = {
      accommodation_id: accommodationId,
      user_id: userId,
      check_in: checkInISO,
      check_out: checkOutISO,
      total_price: totalPrice,
      applied_discount_code: appliedDiscountCode || null,
      discount_amount: discountAmount || null,
      credits_used: creditsUsed || 0,
      status: 'pending_payment',
      created_at: new Date().toISOString(),
      // Store additional data for later use
      user_email: userEmail,
      food_contribution: foodContribution || 0
    };

    console.log('[CreatePendingBooking] Creating pending booking:', pendingBooking);

    const { data: newBooking, error: insertError } = await supabaseAdmin
      .from('bookings')
      .insert(pendingBooking)
      .select('*')
      .single();

    if (insertError) {
      console.error('[CreatePendingBooking] Error inserting booking:', insertError);
      throw new Error(`Failed to create pending booking: ${insertError.message}`);
    }

    console.log('[CreatePendingBooking] Pending booking created:', newBooking.id);

    // Return the pending booking ID to be used in Stripe metadata
    return new Response(
      JSON.stringify({ 
        pendingBookingId: newBooking.id,
        bookingDetails: newBooking 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('[CreatePendingBooking] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create pending booking' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message.includes('not found') ? 404 : 500,
      }
    );
  }
});