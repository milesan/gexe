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

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    // First, fetch the question mapping
    const { data: questions, error: questionsError } = await supabase
      .from('application_questions')
      .select('order_number, text')
      .eq('text', 'First Name')
      .single()

    if (questionsError) {
      console.error('Error fetching question mapping:', questionsError)
      throw questionsError
    }

    // Then fetch application data
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select('data')
      .eq('id', applicationId)
      .single()

    if (fetchError) {
      console.error('Error fetching application:', fetchError)
      throw fetchError
    }

    // Extract first name using the question order number
    const firstName = application?.data?.[questions.order_number * 1000] || ''
    console.log('Found first name:', firstName)
    
    // Get current year
    const currentYear = new Date().getFullYear()
    
    const resendClient = new resend.Resend(resendApiKey)
    
    console.log('Attempting to send rejection email via Resend...')
    
    // Send email using Resend
    const { error } = await resendClient.emails.send({
      from: 'Harvard College Admissions <echo@echo.thegarden.pt>', // Playful sender name
      to: email,
      subject: 'Your Application to H̶a̶r̶v̶a̶r̶d̶ ̶C̶o̶l̶l̶e̶g̶e̶ The Garden',
      html: `
        <p>Dear ${firstName || ''},</p>
        <p>The Committee on Admissions has completed its Regular Decision meetings, and I am very sorry to inform you that we cannot offer you admission to <s>Harvard</s> <s>The Garden Class</s> Residencies of ${currentYear}.</p>
        <p>I wish that a different decision had been possible, but I hope that receiving our final decision now will be helpful to you as you make your <s>college plans</s> life plans.</p>
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