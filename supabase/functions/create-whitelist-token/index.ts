import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface TokenPayload {
  whitelistId: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as TokenPayload
    
    if (!body.whitelistId) {
      throw new Error('Whitelist ID is required')
    }
    
    const { whitelistId } = body
    console.log('Creating token for whitelist entry:', whitelistId)

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

    // First verify the whitelist entry exists and has an email
    console.log('Verifying whitelist entry...')
    const { data: whitelistEntry, error: whitelistError } = await supabaseClient
      .from('whitelist')
      .select('email')
      .eq('id', whitelistId)
      .single()

    if (whitelistError) {
      console.error('Failed to fetch whitelist entry:', whitelistError)
      throw new Error('Failed to verify whitelist entry')
    }

    if (!whitelistEntry || !whitelistEntry.email) {
      console.error('Invalid whitelist entry:', { whitelistId })
      throw new Error('Invalid whitelist entry')
    }

    // Generate a secure random token
    console.log('Generating new whitelist token...')
    const token = crypto.randomUUID()
    console.log('Generated token:', token)

    console.log('Attempting to store token in database...')
    // Store the token
    const { error: insertError } = await supabaseClient
      .from('whitelist_tokens')
      .insert({
        whitelist_id: whitelistId,
        token: token
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
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
