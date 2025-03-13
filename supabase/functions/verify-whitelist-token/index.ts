import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

interface TokenPayload {
  token: string;
}

console.log('verify-whitelist-token function loaded')

serve(async (req) => {
  console.log('Received request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  })

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Parsing request body...')
    const body = await req.json() as TokenPayload
    
    if (!body.token) {
      console.error('No token provided in request body')
      throw new Error('Token is required')
    }
    
    const { token } = body
    console.log('Token received:', { token: token.substring(0, 8) + '...' })

    // Create a Supabase client with service role key
    console.log('Initializing Supabase client...')
    const supabaseUrl = Deno.env.get('BACKEND_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey
      })
      throw new Error('Missing required environment variables')
    }
    
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)
    console.log('Supabase client initialized')

    // Find the token and associated whitelist entry within a transaction
    const now = new Date()
    const { data: tokenData, error: tokenError } = await supabaseClient.rpc('verify_and_use_whitelist_token', {
      p_token: token,
      p_current_time: now.toISOString()  // Still needed for used_at timestamp
    })

    if (tokenError) {
      console.error('Token verification failed:', { error: tokenError })
      return new Response(
        JSON.stringify({ error: tokenError.message || 'Failed to verify token' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!tokenData || !Array.isArray(tokenData) || tokenData.length === 0) {
      console.error('Token not found or invalid')
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const tokenRecord = tokenData[0]
    console.log('Token verified:', {
      tokenId: tokenRecord.token_id,
      whitelistId: tokenRecord.whitelist_id,
      email: tokenRecord.email
    })

    // Check if user already exists
    const email = tokenRecord.email
    console.log('🔍 Processing whitelist token for email:', { email, tokenId: tokenRecord.token_id })
    if (!email) {
      console.error('❌ No email found in token data:', { tokenRecord })
      return new Response(
        JSON.stringify({ error: 'Invalid token: no email associated' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Generate magic link - this creates a passwordless flow
    console.log('🔗 Generating magic link for:', { email })
    await new Promise(resolve => setTimeout(resolve, 10000)) // 5 second delay
    const { data: signInData, error: signInError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        data: {
          is_whitelisted: true,
          has_completed_whitelist_signup: false,
          has_applied: false // Ensure they don't go through application flow
        }
      },
      redirectTo: `${Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'}/whitelist-signup`
    })

    if (signInError) {
      console.error('❌ Failed to generate invite link:', {
        error: signInError,
        email,
        tokenId: tokenRecord.token_id
      })
      throw signInError
    }

    console.log('✅ Successfully generated invite link:', {
      email,
      tokenId: tokenRecord.token_id,
      hasActionLink: !!signInData?.properties?.action_link
    })

    return new Response(
      JSON.stringify({
        data: {
          properties: {
            action_link: signInData.properties.action_link
          }
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Function failed with error:', {
      message: error.message,
      stack: error.stack
    })
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})