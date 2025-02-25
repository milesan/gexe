import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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
    console.log('Request body:', await req.text())  // Log the raw request body
    const body = await req.json() as EmailPayload
    console.log('Parsed request body:', body)
    
    if (!body.email || !body.applicationId) {
      throw new Error('Email and applicationId are required')
    }
    
    const { email, applicationId } = body
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

    console.log('Creating acceptance token...')
    
    // Generate acceptance token using Edge Function
    const { data: tokenData, error: tokenError } = await supabaseClient.functions.invoke('create-acceptance-token', {
      body: { applicationId }
    });

    if (tokenError) {
      console.error('Error creating token:', tokenError)
      throw tokenError
    }

    const acceptanceUrl = `${supabaseUrl}/accept?token=${tokenData.token}`
    
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
