import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface EmailPayload {
  email: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Request body:', await req.text())  // Log the raw request body
    const body = await req.json() as EmailPayload
    console.log('Parsed request body:', body)
    
    if (!body.email) {
      throw new Error('Email is required')
    }
    
    const { email } = body
    console.log('Received request to send email to:', email)

    // Create a Supabase client with service role key
    const supabaseUrl = Deno.env.get('PROJECT_URL')
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey
      })
      throw new Error('Missing required environment variables')
    }
    
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    console.log('Attempting to send email...')
    
    // Send email using Supabase's email service
    const { error } = await supabaseClient
      .from('emails')
      .insert([
        {
          recipient_email: email,
          subject: 'Your Garden Application Has Been Approved!',
          html: `
            <h2>Congratulations!</h2>
            <p>Your application to The Garden has been approved.</p>
            <p>You can now log in to your account and start making bookings.</p>
            <p>Welcome to The Garden community!</p>
          `
        }
      ])

    if (error) {
      console.error('Error sending email:', error)
      throw error
    }

    console.log('Email sent successfully')
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
