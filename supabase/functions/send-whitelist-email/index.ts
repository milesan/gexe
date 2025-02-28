import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as resend from 'https://esm.sh/resend@2.0.0'

interface EmailPayload {
  email: string;
  whitelistId: string;
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
    
    const { email, whitelistId } = body
    console.log('Received request to send email to:', email)

    // Create a Supabase client with service role key
    const supabaseUrl = Deno.env.get('BACKEND_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const frontendUrl = Deno.env.get('FRONTEND_URL')
    
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
        <p>Hello!</p>
        <p>You've been invited to join The Garden. Click the link below to create your account:</p>
        <p><a href="${frontendUrl}/accept-invite?token=${token}">Accept Invitation</a></p>
        <p>This link will expire in 7 days.</p>
        <p>Best regards,<br>The Garden Team</p>
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
