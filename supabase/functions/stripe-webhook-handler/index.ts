import { serve } from 'https://deno.land/std@0.204.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno&deno-version=1.45.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Content-Type': 'application/json',
};

// Initialize logging
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = data ? 
    `[${timestamp}] STRIPE-WEBHOOK-HANDLER: ${message} ${JSON.stringify(data, null, 2)}` : 
    `[${timestamp}] STRIPE-WEBHOOK-HANDLER: ${message}`;
  console.log(logEntry);
};

// Helper to invoke another Supabase function
async function invokeFunction(supabaseAdmin: SupabaseClient, functionName: string, body: object) {
  const { data, error } = await supabaseAdmin.functions.invoke(functionName, { body });
  if (error) {
    log(`ERROR invoking function ${functionName}:`, error);
    throw error;
  }
  return data;
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  log(`Received webhook request ${requestId}`, { 
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // Get webhook signature
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      log(`ERROR: Missing stripe-signature header`);
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // Get raw body for signature verification
    const rawBody = await req.text();
    
    // Get the appropriate webhook secret based on environment
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      log(`ERROR: Missing STRIPE_WEBHOOK_SECRET`);
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY_PRODUCTION');
    if (!stripeKey) {
      log(`ERROR: Missing STRIPE_SECRET_KEY_PRODUCTION`);
      return new Response(JSON.stringify({ error: 'Stripe key not configured' }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      log(`Webhook signature verified for event ${event.id}`, { type: event.type });
    } catch (err) {
      log(`ERROR: Webhook signature verification failed`, { error: err.message });
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      log(`ERROR: Missing Supabase configuration`);
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        headers: corsHeaders,
        status: 500,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        log(`Processing checkout.session.completed for session ${session.id}`);

        // Get pending booking ID from metadata
        const pendingBookingId = session.metadata?.pending_booking_id;
        const userEmail = session.metadata?.user_email;

        if (!pendingBookingId) {
          log(`ERROR: No pending booking ID in session metadata`, { metadata: session.metadata });
          return new Response(JSON.stringify({ received: true }), {
            headers: corsHeaders,
            status: 200,
          });
        }

        log(`Found pending booking ID: ${pendingBookingId}`);

        // Retrieve the pending booking
        const { data: pendingBooking, error: fetchError } = await supabaseAdmin
          .from('bookings')
          .select('*')
          .eq('id', pendingBookingId)
          .eq('status', 'pending_payment')
          .single();

        if (fetchError || !pendingBooking) {
          log(`ERROR: Could not find pending booking ${pendingBookingId}`, { error: fetchError });
          return new Response(JSON.stringify({ received: true }), {
            headers: corsHeaders,
            status: 200,
          });
        }

        log(`Found pending booking:`, pendingBooking);

        // Update booking status to confirmed
        const { data: updatedBooking, error: updateError } = await supabaseAdmin
          .from('bookings')
          .update({
            status: 'confirmed',
            payment_intent_id: session.payment_intent as string,
            updated_at: new Date().toISOString(),
            confirmation_email_sent: false // Will be set to true after email is sent
          })
          .eq('id', pendingBookingId)
          .select()
          .single();

        if (updateError) {
          log(`ERROR: Failed to update booking status`, { error: updateError });
          // Still return 200 to Stripe to prevent retries
          return new Response(JSON.stringify({ received: true }), {
            headers: corsHeaders,
            status: 200,
          });
        }

        log(`Booking ${pendingBookingId} confirmed successfully`);

        // Deduct credits if any were used
        if (pendingBooking.credits_used && pendingBooking.credits_used > 0) {
          log(`Deducting ${pendingBooking.credits_used} credits for user ${pendingBooking.user_id}`);
          
          const { error: creditError } = await supabaseAdmin.rpc('deduct_user_credits', {
            p_user_id: pendingBooking.user_id,
            p_credits_to_deduct: pendingBooking.credits_used
          });

          if (creditError) {
            log(`ERROR: Failed to deduct credits`, { error: creditError });
            // Don't fail the booking, just log the error
          } else {
            log(`Successfully deducted ${pendingBooking.credits_used} credits`);
          }
        }

        // Send confirmation email
        try {
          log(`Sending confirmation email to ${userEmail || pendingBooking.user_email}`);
          
          // Get accommodation details for the email
          const { data: accommodation } = await supabaseAdmin
            .from('accommodations')
            .select('title')
            .eq('id', pendingBooking.accommodation_id)
            .single();

          await invokeFunction(supabaseAdmin, 'send-booking-confirmation', {
            bookingId: pendingBookingId,
            email: userEmail || pendingBooking.user_email,
            checkIn: pendingBooking.check_in,
            checkOut: pendingBooking.check_out,
            accommodationName: accommodation?.title || 'Accommodation',
            totalPrice: pendingBooking.total_price
          });

          // Mark email as sent
          await supabaseAdmin
            .from('bookings')
            .update({ confirmation_email_sent: true })
            .eq('id', pendingBookingId);

          log(`Confirmation email sent successfully`);
        } catch (emailError) {
          log(`ERROR: Failed to send confirmation email`, { error: emailError });
          // Don't fail the webhook, booking is already confirmed
        }

        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const pendingBookingId = session.metadata?.pending_booking_id;

        if (pendingBookingId) {
          log(`Checkout session expired for pending booking ${pendingBookingId}`);
          
          // Update booking status to cancelled
          await supabaseAdmin
            .from('bookings')
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq('id', pendingBookingId)
            .eq('status', 'pending_payment');

          log(`Pending booking ${pendingBookingId} cancelled due to expired session`);
        }
        break;
      }
      
      default:
        log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: corsHeaders,
      status: 200,
    });

  } catch (error) {
    log(`ERROR in webhook handler`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
    }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});