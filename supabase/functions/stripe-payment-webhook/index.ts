import { serve } from 'https://deno.land/std@0.204.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
    `[${timestamp}] STRIPE-PAYMENT-WEBHOOK: ${message} ${JSON.stringify(data, null, 2)}` : 
    `[${timestamp}] STRIPE-PAYMENT-WEBHOOK: ${message}`;
  console.log(logEntry);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get webhook signature
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      log('ERROR: Missing stripe-signature header');
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    // Get the raw request body
    const body = await req.text();
    
    // Determine environment from webhook endpoint secret
    const webhookSecretProd = Deno.env.get('STRIPE_WEBHOOK_SECRET_PRODUCTION');
    const webhookSecretDev = Deno.env.get('STRIPE_WEBHOOK_SECRET_DEVELOPMENT');
    
    let event: Stripe.Event;
    let environment: string;
    let stripeKey: string;
    
    // Try production webhook secret first
    try {
      const stripeProd = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_PRODUCTION') || '', {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
      });
      
      event = await stripeProd.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecretProd || ''
      );
      environment = 'production';
      stripeKey = Deno.env.get('STRIPE_SECRET_KEY_PRODUCTION') || '';
      log('Webhook verified as PRODUCTION environment');
    } catch (prodErr) {
      // If production fails, try development
      try {
        const stripeDev = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_DEVELOPMENT') || '', {
          apiVersion: '2023-10-16',
          httpClient: Stripe.createFetchHttpClient(),
        });
        
        event = await stripeDev.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecretDev || ''
        );
        environment = 'development';
        stripeKey = Deno.env.get('STRIPE_SECRET_KEY_DEVELOPMENT') || '';
        log('Webhook verified as DEVELOPMENT environment');
      } catch (devErr) {
        log('ERROR: Webhook signature verification failed for both environments', {
          prodError: prodErr.message,
          devError: devErr.message
        });
        return new Response(JSON.stringify({ error: 'Webhook signature verification failed' }), {
          headers: corsHeaders,
          status: 400,
        });
      }
    }

    log(`Processing webhook event: ${event.type}`, { 
      eventId: event.id,
      environment 
    });

    // Initialize Stripe with the appropriate key
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        log('Processing checkout.session.completed', {
          sessionId: session.id,
          paymentStatus: session.payment_status,
          customerEmail: session.customer_email || session.customer_details?.email
        });

        // Only process if payment is successful
        if (session.payment_status !== 'paid') {
          log('Session not paid, skipping processing', { 
            sessionId: session.id,
            paymentStatus: session.payment_status 
          });
          break;
        }

        // Get payment intent for metadata
        let paymentIntent: Stripe.PaymentIntent | null = null;
        if (session.payment_intent) {
          paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
          log('Retrieved payment intent', {
            paymentIntentId: paymentIntent.id,
            description: paymentIntent.description,
            metadata: paymentIntent.metadata
          });
        }

        // Check if this payment was created by the frontend booking system
        const isFromFrontend = paymentIntent?.metadata?.source === 'frontend_booking';
        if (isFromFrontend) {
          log('Payment from frontend booking system detected - checking for existing booking first', {
            paymentIntentId: paymentIntent.id,
            metadata: paymentIntent.metadata
          });
          
          // Give frontend time to create the booking (wait a bit before processing)
          // If frontend booking succeeds, webhook will be skipped due to existing booking check
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Check if booking already exists (idempotency and frontend coordination)
        const { data: existingBooking } = await supabaseAdmin
          .from('bookings')
          .select('id, user_id, created_at')
          .eq('payment_intent_id', paymentIntent?.id || session.id)
          .single();

        if (existingBooking) {
          log('Booking already exists for this payment, skipping webhook creation', {
            bookingId: existingBooking.id,
            paymentIntentId: paymentIntent?.id || session.id,
            existingBookingAge: new Date().getTime() - new Date(existingBooking.created_at).getTime()
          });
          break;
        }

        // Try to use metadata first, fallback to description parsing
        let userEmail: string;
        let accommodationId: string;
        let checkInFormatted: string;
        let checkOutFormatted: string;
        let creditsUsed = 0;
        let discountCode: string | null = null;
        let originalTotal: number | null = null;

        if (isFromFrontend && paymentIntent?.metadata) {
          // Use structured metadata from frontend
          log('Using structured metadata from frontend booking', paymentIntent.metadata);
          
          userEmail = paymentIntent.metadata.user_email;
          accommodationId = paymentIntent.metadata.accommodation_id;
          checkInFormatted = paymentIntent.metadata.check_in;
          checkOutFormatted = paymentIntent.metadata.check_out;
          creditsUsed = paymentIntent.metadata.credits_used ? parseInt(paymentIntent.metadata.credits_used) : 0;
          discountCode = paymentIntent.metadata.discount_code || null;
          originalTotal = paymentIntent.metadata.original_total ? parseFloat(paymentIntent.metadata.original_total) : null;

          if (!userEmail || !accommodationId || !checkInFormatted || !checkOutFormatted) {
            log('ERROR: Missing required fields in payment intent metadata', {
              hasEmail: !!userEmail,
              hasAccommodationId: !!accommodationId,
              hasCheckIn: !!checkInFormatted,
              hasCheckOut: !!checkOutFormatted,
              metadata: paymentIntent.metadata
            });
            break;
          }
        } else {
          // Fallback to legacy description parsing
          log('Using legacy description parsing for booking details');
          
          const description = paymentIntent?.description || '';
          const emailMatch = description.match(/^([^,]+),/);
          userEmail = emailMatch ? emailMatch[1].trim() : session.customer_email || session.customer_details?.email;
          
          if (!userEmail) {
            log('ERROR: No user email found in session or payment intent');
            break;
          }

          // Parse accommodation and dates from description
          const accommodationMatch = description.match(/,\s*(.+?)\s+for\s+(\d+)\s+nights?\s+from\s+(\d+)\.\s+(\w+)/);
          if (!accommodationMatch) {
            log('ERROR: Could not parse booking details from description', { description });
            break;
          }

          const [, accommodationTitle, nights, dayStr, monthName] = accommodationMatch;
          
          // Get the current year
          const currentYear = new Date().getFullYear();
          const monthNumber = new Date(`${monthName} 1, ${currentYear}`).getMonth();
          const checkInDate = new Date(currentYear, monthNumber, parseInt(dayStr));
          
          // If the date is in the past, it might be next year
          if (checkInDate < new Date()) {
            checkInDate.setFullYear(currentYear + 1);
          }
          
          const checkOutDate = new Date(checkInDate);
          checkOutDate.setDate(checkOutDate.getDate() + parseInt(nights));

          // Format dates for database
          const formatDate = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };

          checkInFormatted = formatDate(checkInDate);
          checkOutFormatted = formatDate(checkOutDate);

          // Find the accommodation by title
          const { data: accommodationData, error: accommodationError } = await supabaseAdmin
            .from('accommodations')
            .select('id, title')
            .eq('title', accommodationTitle)
            .single();

          if (accommodationError || !accommodationData) {
            log('ERROR: Could not find accommodation by title', { 
              accommodationTitle, 
              error: accommodationError 
            });
            break;
          }

          accommodationId = accommodationData.id;
        }

        log('Parsed booking details', {
          userEmail,
          accommodationId,
          checkIn: checkInFormatted,
          checkOut: checkOutFormatted,
          creditsUsed,
          discountCode,
          originalTotal
        });

        // Find the user by email
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', userEmail)
          .single();

        if (userError || !userData) {
          log('ERROR: Could not find user by email', { userEmail, error: userError });
          break;
        }

        // Create the booking with credit information
        const bookingData = {
          user_id: userData.id,
          accommodation_id: accommodationId,
          check_in: checkInFormatted,
          check_out: checkOutFormatted,
          total_price: (session.amount_total || 0) / 100, // Convert from cents
          status: 'confirmed',
          payment_intent_id: paymentIntent?.id || session.id,
          applied_discount_code: discountCode,
          credits_used: creditsUsed,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        log('Creating booking with credit information', bookingData);

        const { data: newBooking, error: bookingError } = await supabaseAdmin
          .from('bookings')
          .insert(bookingData)
          .select('id')
          .single();

        if (bookingError) {
          log('ERROR: Failed to create booking', { error: bookingError });
          break;
        }

        log('Booking created successfully', { bookingId: newBooking.id });

        // Send confirmation email
        try {
          const frontendUrl = environment === 'production' 
            ? 'https://in.thegarden.pt' 
            : 'http://localhost:5173';

          log('Sending booking confirmation email', {
            email: userEmail,
            bookingId: newBooking.id,
            environment,
            frontendUrl
          });

                      // Get accommodation title for email
            const { data: accommodationInfo } = await supabaseAdmin
              .from('accommodations')
              .select('title')
              .eq('id', accommodationId)
              .single();

            const { error: emailError } = await supabaseAdmin.functions.invoke('send-booking-confirmation', {
              body: {
                email: userEmail,
                bookingId: newBooking.id,
                checkIn: checkInFormatted,
                checkOut: checkOutFormatted,
                accommodation: accommodationInfo?.title || 'Accommodation',
                totalPrice: (session.amount_total || 0) / 100,
                frontendUrl
              }
            });

          if (emailError) {
            log('ERROR: Failed to send confirmation email', { error: emailError });
          } else {
            log('Confirmation email sent successfully');
          }
        } catch (emailErr) {
          log('ERROR: Exception while sending email', { error: emailErr.message });
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
    log('ERROR: Webhook processing failed', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    
    return new Response(JSON.stringify({ 
      error: error.message,
    }), {
      headers: corsHeaders,
      status: 400,
    });
  }
}); 