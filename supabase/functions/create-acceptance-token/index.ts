import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface TokenPayload {
  applicationId: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as TokenPayload
    
    if (!body.applicationId) {
      throw new Error('Application ID is required')
    }
    
    const { applicationId } = body
    console.log('Creating token for application:', applicationId)

    // Create a Supabase client with service role key
    const supabaseUrl = Deno.env.get('BACKEND_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey
      })
      throw new Error('Missing required environment variables')
    }
    
    console.log('Initializing Supabase client with URL:', supabaseUrl)
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)
    console.log('Supabase client initialized successfully')

    // Generate a secure random token
    console.log('Generating new acceptance token...')
    const token = crypto.randomUUID()
    console.log('Generated token:', token)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 14) // Token expires in 14 days
    console.log('Token will expire at:', expiresAt.toISOString())

    console.log('Attempting to store token in database...')
    // Store the token
    const { error: insertError } = await supabaseClient
      .from('acceptance_tokens')
      .insert({
        application_id: applicationId,
        token: token,
        expires_at: expiresAt.toISOString()
      })

    if (insertError) {
      throw insertError
    }

    return new Response(
      JSON.stringify({ token }),
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
