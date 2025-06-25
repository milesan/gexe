import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as resend from 'https://esm.sh/resend@2.0.0'

interface BookingFailurePayload {
  paymentIntentId?: string;
  userEmail: string;
  error: string;
  errorStack?: string;
  bookingDetails: {
    accommodation: string;
    checkIn: string;
    checkOut: string;
    totalPaid: number;
    originalTotal?: number;
    creditsUsed?: number;
    discountCode?: string;
  };
  systemStatus?: {
    confirmationEmailSent: boolean;
    creditsWereDeducted: boolean;
    userWillSeeConfirmationPage: boolean;
  };
  timestamp?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as BookingFailurePayload
    console.log('[Alert Booking Failure] Received request:', body)
    
    if (!body.userEmail || !body.bookingDetails) {
      throw new Error('User email and booking details are required')
    }
    
    // Get environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!resendApiKey) {
      console.error('[Alert Booking Failure] Missing RESEND_API_KEY')
      throw new Error('Missing required environment variables')
    }
    
    const resendClient = new resend.Resend(resendApiKey)
    
    // Also log to bug_reports table for persistence
    if (supabaseUrl && serviceRoleKey) {
      const supabaseClient = createClient(supabaseUrl, serviceRoleKey)
      
      const bugReportDescription = `CRITICAL: Payment received but booking creation failed!
          
Payment Intent: ${body.paymentIntentId || 'N/A'}
User Email: ${body.userEmail}
Accommodation: ${body.bookingDetails.accommodation}
Check-in: ${body.bookingDetails.checkIn}
Check-out: ${body.bookingDetails.checkOut}
Amount Paid: €${body.bookingDetails.totalPaid}${body.bookingDetails.originalTotal && body.bookingDetails.originalTotal !== body.bookingDetails.totalPaid ? `\nOriginal Total: €${body.bookingDetails.originalTotal}` : ''}
Credits Used: ${body.bookingDetails.creditsUsed || 0}
Discount Code: ${body.bookingDetails.discountCode || 'None'}
Timestamp: ${body.timestamp || new Date().toISOString()}

SYSTEM STATUS:
- Confirmation Email: ${body.systemStatus?.confirmationEmailSent ? 'SENT' : 'FAILED'}
- Credits Deducted: ${body.systemStatus?.creditsWereDeducted ? 'YES (CORRECT - User paid reduced amount)' : 'NO (Credits still available)'}
- User Experience: ${body.systemStatus?.userWillSeeConfirmationPage ? 'SEES CONFIRMATION' : 'SEES ERROR'}

Error: ${body.error}
${body.errorStack ? `\nStack Trace:\n${body.errorStack}` : ''}

Please manually create the booking for this user or process a refund.`;

      try {
        await supabaseClient
          .from('bug_reports')
          .insert({
            description: bugReportDescription,
            steps_to_reproduce: 'Automatic report: Booking creation failed after successful payment.',
            page_url: '/book',
            status: 'critical',
            user_id: null // System generated
          })
        console.log('[Alert Booking Failure] Bug report logged successfully')
      } catch (dbError) {
        console.error('[Alert Booking Failure] Failed to log to bug_reports:', dbError)
      }
    }
    
    // Format the email content
    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #1f2937; margin: 0 0 20px 0;">Booking Creation Failed After Payment</h2>
        
        <p style="color: #4b5563; margin-bottom: 20px;">
          A payment was processed but the booking creation failed. Manual intervention required.
        </p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 15px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px;">Payment Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 5px 0; color: #6b7280;">Payment Intent:</td><td style="color: #1f2937;">${body.paymentIntentId || 'Not Available'}</td></tr>
            <tr><td style="padding: 5px 0; color: #6b7280;"><strong>Amount Paid:</strong></td><td style="color: #1f2937; font-weight: bold;">€${body.bookingDetails.totalPaid}</td></tr>
            ${body.bookingDetails.originalTotal && body.bookingDetails.originalTotal !== body.bookingDetails.totalPaid ? 
              `<tr><td style="padding: 5px 0; color: #6b7280;">Original Total:</td><td style="color: #6b7280;">€${body.bookingDetails.originalTotal}</td></tr>` : ''}
            <tr><td style="padding: 5px 0; color: #6b7280;">Time:</td><td style="color: #1f2937;">${new Date(body.timestamp || Date.now()).toLocaleString()}</td></tr>
          </table>
        </div>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 15px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px;">Booking Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 5px 0; color: #6b7280;">Customer:</td><td style="color: #1f2937;">${body.userEmail}</td></tr>
            <tr><td style="padding: 5px 0; color: #6b7280;">Accommodation:</td><td style="color: #1f2937;">${body.bookingDetails.accommodation}</td></tr>
            <tr><td style="padding: 5px 0; color: #6b7280;">Check-in:</td><td style="color: #1f2937;">${body.bookingDetails.checkIn}</td></tr>
            <tr><td style="padding: 5px 0; color: #6b7280;">Check-out:</td><td style="color: #1f2937;">${body.bookingDetails.checkOut}</td></tr>
            ${body.bookingDetails.creditsUsed ? `<tr><td style="padding: 5px 0; color: #6b7280;">Credits:</td><td style="color: #1f2937;">${body.bookingDetails.creditsUsed}</td></tr>` : ''}
            ${body.bookingDetails.discountCode ? `<tr><td style="padding: 5px 0; color: #6b7280;">Discount:</td><td style="color: #1f2937;">${body.bookingDetails.discountCode}</td></tr>` : ''}
          </table>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-bottom: 15px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px;">Error Information</h3>
          <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>Message:</strong> ${body.error}</p>
          ${body.errorStack ? `
            <details style="margin-top: 10px;">
              <summary style="cursor: pointer; color: #4b5563; font-size: 14px;">Full stack trace</summary>
              <pre style="background-color: #1f2937; color: #f3f4f6; padding: 10px; border-radius: 5px; margin-top: 10px; overflow-x: auto; font-size: 11px; line-height: 1.4; white-space: pre-wrap; word-break: break-all;">${body.errorStack}</pre>
            </details>
          ` : ''}
        </div>
        
        ${body.systemStatus ? `
        <div style="background-color: ${body.systemStatus.confirmationEmailSent && !body.systemStatus.creditsWereDeducted ? '#dcfce7' : '#fef3c7'}; padding: 15px; border-radius: 5px; margin-bottom: 15px; border: 1px solid ${body.systemStatus.confirmationEmailSent && !body.systemStatus.creditsWereDeducted ? '#16a34a' : '#f59e0b'};">
          <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px;">🔧 System Status</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 5px 0; color: #4b5563;">Confirmation Email:</td><td style="color: ${body.systemStatus.confirmationEmailSent ? '#16a34a' : '#dc2626'}; font-weight: bold;">${body.systemStatus.confirmationEmailSent ? '✅ SENT' : '❌ FAILED'}</td></tr>
            <tr><td style="padding: 5px 0; color: #4b5563;">Credits Deducted:</td><td style="color: ${body.systemStatus.creditsWereDeducted ? '#16a34a' : '#f59e0b'}; font-weight: bold;">${body.systemStatus.creditsWereDeducted ? '✅ YES (CORRECT)' : '⚠️ NO (Still Available)'}</td></tr>
            <tr><td style="padding: 5px 0; color: #4b5563;">User Experience:</td><td style="color: ${body.systemStatus.userWillSeeConfirmationPage ? '#16a34a' : '#dc2626'}; font-weight: bold;">${body.systemStatus.userWillSeeConfirmationPage ? '✅ SEES CONFIRMATION' : '❌ SEES ERROR'}</td></tr>
          </table>
        </div>
        ` : ''}
        
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; border: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Please create the booking manually or process a refund through Stripe.
          </p>
        </div>
      </div>
    `

    console.log('[Alert Booking Failure] Sending email alerts...')

    // Send email to test recipient only for now
    const adminEmails = ['redis213@gmail.com']
    
    const { error } = await resendClient.emails.send({
      from: 'The Garden <alerts@echo.thegarden.pt>',
      to: adminEmails,
      replyTo: body.userEmail, // So admins can easily reply to the customer
      subject: `Booking Failed After Payment - ${body.userEmail}`,
      html: emailHtml
    })

    if (error) {
      console.error('[Alert Booking Failure] Error sending email via Resend:', error)
      throw error
    }

    console.log('[Alert Booking Failure] Email alerts sent successfully to:', adminEmails)
    
    return new Response(
      JSON.stringify({ 
        message: 'Alert sent successfully',
        recipients: adminEmails
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('[Alert Booking Failure] Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 