import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as resend from 'https://esm.sh/resend@2.0.0'

interface EmailPayload {
  email: string;
  applicationId: string;
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
    
    const { email, applicationId } = body
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
      from: 'Garden Team <echo@echo.thegarden.pt>', // Replace with your verified domain
      to: email,
      subject: 'Your Garden Application Has Been Approved!',
      html: `
        <h2>Congratulations!</h2>
        <p>We're excited to inform you that your application to join Garden has been approved!</p>
        <p>To complete your registration and join our community, please click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${acceptanceUrl}" style="background-color: #064e3b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p>${acceptanceUrl}</p>
        <p>This invitation link will expire in 7 days.</p>
        <p>Welcome to Garden!</p>
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