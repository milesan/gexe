import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as resend from 'https://esm.sh/resend@2.0.0'
import { formatInTimeZone, addDays } from 'https://esm.sh/date-fns-tz@2.0.0?deps=date-fns@2.30.0'

const localCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Max-Age': '86400'
};
const combinedCorsHeaders = { ...corsHeaders };

const REMINDER_DAYS_BEFORE = 3;

function generateArrivalReminderEmail() {
  const welcomeDocUrl = "https://gardening.notion.site/Welcome-to-The-Garden-2684f446b48e4b43b3f003d7fca33664?pvs=74";
  const samTelegramUrl = "https://t.me/greeneggssam";
  return `
    <div style="font-family: serif;">
      <p>Dear friend of the forest,</p>
      <p>The day is fast-approaching; soon the gates will beckon you in.</p>
      <p>If you haven't already, please familiarise yourself with our <a href="${welcomeDocUrl}" target="_blank">Welcome Doc</a> & e-sign the agreements.</p>
      <p>Your point of contact is <a href="${samTelegramUrl}" target="_blank">Sam on Telegram</a>. Please let him know of your ETA and any relevant arrival info.</p>
      <p>Looking forward to meeting you in the enchanted forest...</p>
      <p>From the moss,<br/>Dawn, Sam & The Garden Team</p>
    </div>
  `;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: combinedCorsHeaders })
  }

  try {
    // Setup env
    const supabaseUrl = Deno.env.get('BACKEND_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      throw new Error('Missing required environment variables')
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const resendClient = new resend.Resend(resendApiKey)

    // Calculate date range (today to 3 days from now)
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const threeDaysFromNow = new Date(today)
    threeDaysFromNow.setUTCDate(threeDaysFromNow.getUTCDate() + REMINDER_DAYS_BEFORE)
    
    const todayStr = today.toISOString().slice(0, 10) // 'YYYY-MM-DD'
    const threeDaysFromNowStr = threeDaysFromNow.toISOString().slice(0, 10) // 'YYYY-MM-DD'

    console.log('Looking for bookings with check_in between', todayStr, 'and', threeDaysFromNowStr)

    // Query the view to get bookings with emails within the next 3 days
    const { data: bookings, error: queryError } = await supabase
      .from('bookings_with_emails')
      .select('id, user_email, guest_email, check_in, status')
      .eq('reminder_email_sent', false)
      .gte('check_in', todayStr)
      .lte('check_in', threeDaysFromNowStr)
      .or('user_email.not.is.null,guest_email.not.is.null') // Ensure there is either a user email or guest email
      .not('status', 'eq', 'cancelled')

    if (queryError) {
      console.error('Error querying bookings view:', queryError)
      throw queryError
    }
    if (!bookings || bookings.length === 0) {
      console.log('No bookings found for reminder.')
      return new Response(JSON.stringify({ message: 'No reminders to send.' }), {
        headers: { ...combinedCorsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    let sentCount = 0
    for (const booking of bookings) {
      const { id, user_email, guest_email } = booking
      
      // Use user_email if available, otherwise fall back to guest_email
      const email = user_email || guest_email

      if (!email) {
        console.warn('Booking', id, 'has no email (neither user_email nor guest_email), skipping.')
        continue
      }

      try {
        // Send email
        const { error: emailError } = await resendClient.emails.send({
          from: 'The Garden <echo@echo.thegarden.pt>',
          to: email,
          replyTo: 'living@thegarden.pt',
          subject: 'Your Stay at The Garden – Arrival Info',
          html: generateArrivalReminderEmail(),
        })
        if (emailError) {
          console.error('Error sending reminder for booking', id, ':', emailError)
          continue
        }
        // Mark as sent
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ reminder_email_sent: true })
          .eq('id', id)
        if (updateError) {
          console.error('Error updating booking', id, ':', updateError)
        } else {
          sentCount++
          console.log('Reminder sent and marked for booking', id, 'to', email)
        }
      } catch (err) {
        console.error('Exception sending reminder for booking', id, ':', err)
      }
    }

    return new Response(JSON.stringify({ message: `Reminders sent: ${sentCount}` }), {
      headers: { ...combinedCorsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message, details: error.toString(), stack: error.stack }),
      {
        headers: { ...combinedCorsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 