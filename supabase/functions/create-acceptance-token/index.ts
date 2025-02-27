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
    const projectUrl = Deno.env.get('PROJECT_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!projectUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', {
        hasProjectUrl: !!projectUrl,
        hasServiceRoleKey: !!serviceRoleKey
      })
      throw new Error('Missing required environment variables')
    }
    
    const supabaseClient = createClient(projectUrl, serviceRoleKey)

    // Generate a secure random token
    const token = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Token expires in 7 days

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
