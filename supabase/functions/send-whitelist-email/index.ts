import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as resend from 'https://esm.sh/resend@2.0.0'
import { styles } from '../_shared/email-templates.ts'

// Use combined CORS headers
const combinedCorsHeaders = { ...corsHeaders };

interface EmailPayload {
  email: string;
  whitelistId: string;
  frontendUrl?: string; // Optional, will fallback to env vars if not provided
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: combinedCorsHeaders })
  }

  try {
    const body = await req.json() as EmailPayload
    console.log('Received whitelist email request:', body)
    
    if (!body.email || !body.whitelistId) {
      throw new Error('Email and whitelistId are required')
    }
    
    const { email, whitelistId, frontendUrl: requestUrl } = body
    console.log('Sending whitelist email to:', email)

    // Create a Supabase client with service role key
    const supabaseUrl = Deno.env.get('BACKEND_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    // Get frontend URL with priority:
    // 1. URL passed in request (comes from window.location.origin)
    // 2. Environment variables (fallback)
    // 3. Production URL (last resort fallback)
    const normalizeUrl = (url: string): string => {
      // Remove any trailing slashes
      url = url.replace(/\/+$/, '')
      
      // If URL doesn't start with http:// or https://, add https://
      if (!url.match(/^https?:\/\//i)) {
        url = 'https://' + url
      }
      
      try {
        // Use URL constructor to validate and normalize the URL
        const normalizedUrl = new URL(url)
        return normalizedUrl.toString().replace(/\/+$/, '')
      } catch (e) {
        console.error('Invalid URL format:', url, e)
        throw new Error('Invalid URL format')
      }
    }

    const frontendUrl = normalizeUrl(
      requestUrl || 
      Deno.env.get('FRONTEND_URL') || 
      Deno.env.get('DEPLOY_URL') || 
      Deno.env.get('APP_URL') || 
      'https://in.thegarden.pt'
    )
    
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

    console.log('Creating whitelist token...')
    
    // Generate whitelist token using Edge Function
    const { data: tokenData, error: tokenError } = await supabaseClient.functions.invoke('create-whitelist-token', {
      body: { whitelistId }
    })

    if (tokenError) {
      console.error('Error generating whitelist token:', tokenError)
      throw tokenError
    }

    const token = tokenData.token
    console.log('Generated token successfully')

    // Send email using Resend
    console.log('Attempting to send whitelist email via Resend...')
    const { error: emailError } = await resendClient.emails.send({
      from: 'The Garden <echo@echo.thegarden.pt>',
      to: email,
      replyTo: 'living@thegarden.pt',
      subject: 'Welcome to The Garden',
      html: `
        <div style="${styles.container}">
          <h1 style="${styles.heading}">Welcome to The Garden!</h1>
          
          <div style="${styles.card}">
            <h2 style="${styles.heading}">You're on the List!</h2>
            <p style="${styles.value}">You've been whitelisted, which means you do not need to apply to come to the Garden. This means you must be like, SUPER cool and original and kind.</p>
            <p style="${styles.value}">Congratulations, we are all so very happy for you.</p>
          </div>
          
          <div style="${styles.infoCard}">
            <h3 style="${styles.heading}" style="margin-top: 0;">Next Steps</h3>
            <p style="${styles.value}">Click the button below to accept your invitation and get started on your journey with us.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${frontendUrl}/accept-invite?token=${token}" style="${styles.button}">
              Accept Invitation
            </a>
          </div>
          
          <div style="${styles.footer}">
            <p>Hope to see you soon,<br>the elves</p>
          </div>
        </div>
      `
    })

    if (emailError) {
      console.error('Error sending email via Resend:', emailError)
      throw emailError
    }

    console.log('Whitelist email sent successfully')
    
    // Update the whitelist record to mark email as sent
    const { error: updateError } = await supabaseClient
      .from('whitelist')
      .update({ invitation_email_sent: true })
      .eq('id', whitelistId)
    
    if (updateError) {
      console.error('Error updating whitelist record:', updateError)
      // Don't throw here - email was sent successfully, so return success
    } else {
      console.log('Whitelist record updated: invitation_email_sent = true')
    }

    return new Response(
      JSON.stringify({ message: 'Whitelist email sent successfully' }),
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
