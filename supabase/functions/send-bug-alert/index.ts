import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as resend from 'https://esm.sh/resend@2.0.0'
import { formatInTimeZone } from 'https://esm.sh/date-fns-tz@2.0.0?deps=date-fns@2.30.0'

// Also define CORS headers directly here as a backup
const localCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Max-Age': '86400'
};

// Use combined CORS headers
const combinedCorsHeaders = { ...corsHeaders };

interface BugAlertPayload {
  bugId: string;
  description: string;
  steps_to_reproduce?: string;
  page_url: string;
  status: string;
  user_id?: string;
  user_email?: string;
  image_urls?: string[];
  created_at: string;
}

function generateBugAlertEmail(bug: BugAlertPayload): string {
  const formattedDate = formatInTimeZone(new Date(bug.created_at), 'UTC', 'EEEE, MMMM d, yyyy \'at\' HH:mm \'UTC\'');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .bug-details { background: white; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .label { font-weight: bold; color: #666; }
        .critical { color: #ff4444; font-weight: bold; }
        .new { color: #ff8c00; font-weight: bold; }
        .code { background: #f4f4f4; padding: 10px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; }
        .footer { background: #333; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; }
        .images { margin: 10px 0; }
        .images img { max-width: 200px; margin: 5px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🐛 Bug Alert - The Garden</h1>
        <p>Hey, there's a bug.</p>
      </div>
      
      <div class="content">
        <div class="bug-details">
          <p><span class="label">Bug ID:</span> ${bug.bugId}</p>
          <p><span class="label">Status:</span> <span class="${bug.status}">${bug.status.toUpperCase()}</span></p>
          <p><span class="label">Reported:</span> ${formattedDate}</p>
          <p><span class="label">Page:</span> ${bug.page_url}</p>
          ${bug.user_email ? `<p><span class="label">User:</span> ${bug.user_email}</p>` : '<p><span class="label">User:</span> System generated</p>'}
        </div>

        <div class="bug-details">
          <p class="label">Description:</p>
          <div class="code">${bug.description}</div>
        </div>

        ${bug.steps_to_reproduce ? `
        <div class="bug-details">
          <p class="label">Steps to Reproduce:</p>
          <div class="code">${bug.steps_to_reproduce}</div>
        </div>` : ''}

        ${bug.image_urls && bug.image_urls.length > 0 ? `
        <div class="bug-details">
          <p class="label">Attachments:</p>
          <div class="images">
            ${bug.image_urls.map(url => `<img src="${url}" alt="Bug attachment" />`).join('')}
          </div>
        </div>` : ''}
      </div>

      <div class="footer">
        <p>Check Supabase dashboard to view full details and manage this bug report.</p>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: combinedCorsHeaders })
  }

  try {
    const body = await req.json() as BugAlertPayload
    console.log('Received bug alert request:', body)
    
    if (!body.bugId || !body.description) {
      throw new Error('Bug ID and description are required')
    }
    
    console.log('Sending bug alert email for bug:', body.bugId)

    // Get environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      console.error('Missing environment variables:', {
        hasResendApiKey: !!resendApiKey
      })
      throw new Error('Missing required environment variables')
    }
    
    const resendClient = new resend.Resend(resendApiKey)

    console.log('Attempting to send bug alert email via Resend...')
    
    // Send email using Resend
    const { error } = await resendClient.emails.send({
      from: 'The Garden Bug Alert <echo@echo.thegarden.pt>',
      to: 'redis213@gmail.com',
      subject: `🐛 New Bug Report - The Garden [${body.status.toUpperCase()}]`,
      html: generateBugAlertEmail(body)
    })

    if (error) {
      console.error('Error sending email via Resend:', error)
      throw error
    }

    console.log('Bug alert email sent successfully')
    
    return new Response(
      JSON.stringify({ message: 'Bug alert email sent successfully' }),
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