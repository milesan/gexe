import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as resend from 'https://esm.sh/resend@2.0.0'
import { format } from 'https://esm.sh/date-fns@2.30.0'
import { formatInTimeZone } from 'https://esm.sh/date-fns-tz@2.0.0?deps=date-fns@2.30.0'
import { generateBookingConfirmationEmail } from '../_shared/email-templates.ts'

// Also define CORS headers directly here as a backup
const localCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Max-Age': '86400'
};

// Use combined CORS headers
const combinedCorsHeaders = { ...corsHeaders };

interface BookingConfirmationPayload {
  email: string;
  bookingId: string;
  checkIn: string;
  checkOut: string;
  accommodation: string;
  totalPrice: number;
  frontendUrl?: string; // Optional, will fallback to env vars if not provided
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: combinedCorsHeaders })
  }

  try {
    const body = await req.json() as BookingConfirmationPayload
    console.log('Received booking confirmation request:', body)
    
    if (!body.email || !body.bookingId || !body.checkIn || !body.checkOut || !body.accommodation) {
      throw new Error('Email, bookingId, checkIn, checkOut, and accommodation are required')
    }
    
    const { 
      email, 
      bookingId, 
      checkIn, 
      checkOut, 
      accommodation, 
      totalPrice, 
      frontendUrl: requestUrl 
    } = body
    
    console.log('Sending booking confirmation to:', email)

    // Create a Supabase client with service role key
    const supabaseUrl = Deno.env.get('BACKEND_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    // Get frontend URL with priority:
    // 1. URL passed in request (comes from window.location.origin)
    // 2. Environment variables (fallback)
    // 3. Production URL (last resort fallback)
    const frontendUrl = requestUrl || 
                       Deno.env.get('FRONTEND_URL') || 
                       Deno.env.get('DEPLOY_URL') || 
                       Deno.env.get('APP_URL') || 
                       'https://in.thegarden.pt' // Production fallback
    
    console.log('Using frontend URL:', frontendUrl, '(source: ' + (requestUrl ? 'request' : 'environment') + ')')
    
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !frontendUrl) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
        hasResendApiKey: !!resendApiKey,
        hasFrontendUrl: !!frontendUrl
      })
      throw new Error('Missing required environment variables')
    }
    
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)
    const resendClient = new resend.Resend(resendApiKey)

    // Format dates for display using UTC, ensuring parsing assumes UTC
    const checkInDate = new Date(checkIn + 'T00:00:00Z') // Append Z for UTC
    const checkOutDate = new Date(checkOut + 'T00:00:00Z') // Append Z for UTC
    const formattedCheckIn = formatInTimeZone(checkInDate, 'UTC', 'EEEE, MMMM d, yyyy')
    const formattedCheckOut = formatInTimeZone(checkOutDate, 'UTC', 'EEEE, MMMM d, yyyy')
    
    // Link to booking details
    const bookingDetailsUrl = `${frontendUrl}/my-bookings`
    
    console.log('Attempting to send booking confirmation email via Resend...')
    
    // Send email using Resend
    const { error } = await resendClient.emails.send({
      from: 'The Garden <echo@echo.thegarden.pt>',
      to: email,
      replyTo: 'living@thegarden.pt',
      subject: 'Your Booking Confirmation - The Garden',
      html: generateBookingConfirmationEmail({
        accommodation,
        formattedCheckIn,
        formattedCheckOut,
        totalPrice,
        bookingDetailsUrl
      })
    })

    if (error) {
      console.error('Error sending email via Resend:', error)
      throw error
    }

    console.log('Booking confirmation email sent successfully')
    
    // Update the booking to mark email as sent
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({ confirmation_email_sent: true })
      .eq('id', bookingId)
    
    if (updateError) {
      console.error('Error updating booking record:', updateError)
      // Don't throw here - email was sent successfully, so return success
    } else {
      console.log('Booking record updated: confirmation_email_sent = true')
    }

    return new Response(
      JSON.stringify({ message: 'Booking confirmation email sent successfully' }),
      {
        headers: { ...combinedCorsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString(),
        stack: error.stack 
      }),
      {
        headers: { ...combinedCorsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 