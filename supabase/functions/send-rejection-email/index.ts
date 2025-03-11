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
    console.log('Received request to send rejection email to:', email)

    // Create a Supabase client with service role key
    const supabaseUrl = Deno.env.get('BACKEND_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
        hasResendApiKey: !!resendApiKey
      })
      throw new Error('Missing required environment variables')
    }
    
    const resendClient = new resend.Resend(resendApiKey)
    
    console.log('Attempting to send rejection email via Resend...')
    
    // Send email using Resend
    const { error } = await resendClient.emails.send({
      from: 'Garden Team <echo@echo.thegarden.pt>', // Replace with your verified domain
      to: email,
      subject: 'Update on Your Garden Application',
      html: `
        <h2>Thank you for Your Interest in Garden</h2>
        <p>We appreciate the time and effort you put into your application to join Garden.</p>
        <p>After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.</p>
        <p>While we were impressed by many aspects of your application, we have to make difficult decisions based on our current community needs and capacity.</p>
        <p>We encourage you to stay connected with Garden and consider applying again in the future as our community evolves.</p>
        <p>We wish you all the best in your future endeavors.</p>
        <p>Best regards,<br>The Garden Team</p>
      `
    })

    if (error) {
      console.error('Error sending email via Resend:', error)
      throw error
    }

    console.log('Rejection email sent successfully via Resend')
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