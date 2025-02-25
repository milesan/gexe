import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface TokenPayload {
  token: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as TokenPayload
    
    if (!body.token) {
      throw new Error('Token is required')
    }
    
    const { token } = body
    console.log('Verifying token:', token)

    // Create a Supabase client with service role key
    const supabaseUrl = Deno.env.get('PROJECT_URL')
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables')
    }
    
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    // Get and verify the token
    const { data: tokenData, error: selectError } = await supabaseClient
      .from('acceptance_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (selectError) {
      throw selectError
    }

    if (!tokenData) {
      throw new Error('Invalid token')
    }

    if (tokenData.used_at) {
      throw new Error('Token has already been used')
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error('Token has expired')
    }

    // Mark token as used
    const { error: updateError } = await supabaseClient
      .from('acceptance_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    if (updateError) {
      throw updateError
    }

    // Get application details
    const { data: applicationData, error: appError } = await supabaseClient
      .from('applications')
      .select('*')
      .eq('id', tokenData.application_id)
      .single()

    if (appError) {
      throw appError
    }

    // Add user to whitelist
    const { error: whitelistError } = await supabaseClient
      .from('whitelist')
      .insert({
        email: applicationData.user_email,
        status: 'approved',
        year: '2025'
      })

    if (whitelistError) {
      throw whitelistError
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
