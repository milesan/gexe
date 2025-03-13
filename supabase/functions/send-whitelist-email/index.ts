import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as resend from 'https://esm.sh/resend@2.0.0'

interface EmailPayload {
  email: string;
  whitelistId: string;
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
    
    if (!body.email || !body.whitelistId) {
      throw new Error('Email and whitelistId are required')
    }
    
    const { email, whitelistId, frontendUrl: requestUrl } = body
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
    
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
        hasResendApiKey: !!resendApiKey
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
      throw tokenError
    }

    const token = tokenData.token
    console.log('Generated token:', token)

    // Send email using Resend
    console.log('Sending email...')
    const { data: emailData, error: emailError } = await resendClient.emails.send({
      from: 'The Garden <echo@echo.thegarden.pt>',
      to: email,
      subject: 'Welcome to The Garden',
      html: `
        <p>Hi hi,</p>
        <p>You've been whitelisted, which means you do not need to apply to come to the Garden. This means you must be like, SUPER cool and original and kind.</p>
        <p>Congratulations, we are all so very happy for you.</p>
        <p><a href="${frontendUrl}/accept-invite?token=${token}">Accept Invitation</a></p>
        <p>Hope to see you soon,<br>the elves</p>
      `
    })

    if (emailError) {
      throw emailError
    }

    console.log('Email sent successfully:', emailData)

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
