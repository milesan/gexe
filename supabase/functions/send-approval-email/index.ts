import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as resend from 'https://esm.sh/resend@2.0.0'
import { styles } from '../_shared/email-templates.ts'

interface EmailPayload {
  email: string;
  applicationId: string;
  frontendUrl?: string; // Optional, will fallback to env vars if not provided
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as EmailPayload
    console.log('Received request body:', body)
    
    if (!body.email || !body.applicationId) {
      throw new Error('Email and applicationId are required')
    }
    
    const { email, applicationId, frontendUrl: requestUrl } = body
    console.log('Received request to send email to:', email)

    // Create a Supabase client with service role key
    const supabaseUrl = Deno.env.get('BACKEND_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    // Get frontend URL with priority:
    // 1. URL passed in request (most reliable, comes from window.location.origin)
    // 2. Environment variables (fallback for backward compatibility)
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

    console.log('Creating acceptance token...')
    
    // Generate acceptance token using Edge Function
    const { data: tokenData, error: tokenError } = await supabaseClient.functions.invoke('create-acceptance-token', {
      body: { applicationId }
    });

    if (tokenError) {
      console.error('Error creating token:', tokenError)
      throw tokenError
    }

    const acceptanceUrl = `${frontendUrl}/accept?token=${tokenData.token}`
    
    console.log('Attempting to send email via Resend...')
    
    // Send email using Resend
    const { error } = await resendClient.emails.send({
      from: 'Garden Team <echo@echo.thegarden.pt>',
      to: email,
      subject: 'Garden Application Status',
      html: `
        <div style="${styles.container}">
          <h1 style="${styles.heading}">Welcome to The Garden!</h1>
          
          <div style="${styles.card}">
            <h2 style="${styles.heading}">Your Application Has Been Approved</h2>
            
            <p style="${styles.value}">Callooh, callay! O frabjous day!</p>
            <p style="${styles.value}">Your application has been approved and we're excited to have you join our community.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptanceUrl}" style="${styles.button}">
                Accept Invitation
              </a>
            </div>
            
            <p style="${styles.value}">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="${styles.value}">${acceptanceUrl}</p>
          </div>
          
          <div style="${styles.infoCard}">
            <h3 style="${styles.heading}" style="margin-top: 0;">Important Information</h3>
            <ul style="color: #115e59; padding-left: 20px; margin: 15px 0;">
              <li style="margin-bottom: 8px;">This invitation link will expire in 14 days</li>
              <li style="margin-bottom: 8px;">Please complete your registration to access all Garden features</li>
              <li style="margin-bottom: 8px;">Welcome aboard, sailors, scientists, and sirens of the seas</li>
            </ul>
          </div>
        </div>
      `
    })

    if (error) {
      console.error('Error sending email via Resend:', error)
      throw error
    }

    console.log('Email sent successfully via Resend')
    return new Response(
      JSON.stringify({ message: 'Email sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})