import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as resend from 'https://esm.sh/resend@2.0.0'
import { format } from 'https://esm.sh/date-fns@2.30.0'

// Also define CORS headers directly here as a backup
const localCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

// Use combined CORS headers
const combinedCorsHeaders = { ...corsHeaders, ...localCorsHeaders };

interface BookingConfirmationPayload {
  email: string;
  bookingId: string;
  checkIn: string;
  checkOut: string;
  accommodation: string;
  totalPrice: number;
  guests: number;
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
      guests,
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

    // Format dates for display
    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)
    const formattedCheckIn = format(checkInDate, 'EEEE, MMMM d, yyyy')
    const formattedCheckOut = format(checkOutDate, 'EEEE, MMMM d, yyyy')
    
    // Link to booking details
    const bookingDetailsUrl = `${frontendUrl}/my-bookings/${bookingId}`
    
    console.log('Attempting to send booking confirmation email via Resend...')
    
    // Send email using Resend
    const { error } = await resendClient.emails.send({
      from: 'Garden Team <echo@echo.thegarden.pt>',
      to: email,
      subject: 'Your Booking Confirmation - The Garden',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #064e3b; text-align: center;">Booking Confirmed!</h1>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #064e3b; margin-top: 0;">Your Journey Details</h2>
            
            <div style="margin: 15px 0;">
              <strong style="display: block; color: #334155;">Accommodation:</strong>
              <span style="font-size: 18px;">${accommodation}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin: 15px 0;">
              <div>
                <strong style="display: block; color: #334155;">Check-in:</strong>
                <span>${formattedCheckIn}</span>
                <p style="margin: 5px 0; color: #059669; font-size: 14px;">Available 3-8PM</p>
              </div>
              
              <div>
                <strong style="display: block; color: #334155;">Check-out:</strong>
                <span>${formattedCheckOut}</span>
                <p style="margin: 5px 0; color: #059669; font-size: 14px;">By 12PM Noon</p>
              </div>
            </div>
            
            <div style="margin: 15px 0;">
              <strong style="display: block; color: #334155;">Guests:</strong>
              <span>${guests} ${guests === 1 ? 'Person' : 'People'}</span>
            </div>
            
            <div style="margin: 15px 0; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              <strong style="display: block; color: #334155;">Total Amount:</strong>
              <span style="font-size: 18px;">€${totalPrice}</span>
            </div>
          </div>
          
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #064e3b; margin-top: 0;">Important Information</h3>
            <ul style="color: #115e59; padding-left: 20px;">
              <li>This is a co-created experience.</li>
              <li>The Garden is a strictly smoke & alcohol-free space</li>
              <li>Lunch & dinner included Monday-Friday</li>
              <li>To ensure a smooth arrival, please respect the check-in window (3PM-8PM) and check-out time (12PM)</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${bookingDetailsUrl}" style="background-color: #064e3b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Booking Details
            </a>
          </div>
          
          <p style="color: #64748b; text-align: center; font-size: 14px;">
            If you have any questions, please contact us at support@thegarden.pt
          </p>
        </div>
      `
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