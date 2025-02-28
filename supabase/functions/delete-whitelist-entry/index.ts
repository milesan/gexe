import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('BACKEND_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { id } = await req.json()
    if (!id) {
      throw new Error('Missing whitelist entry ID')
    }

    // First delete all associated tokens
    const { error: tokenError } = await supabaseClient
      .from('whitelist_tokens')
      .delete()
      .eq('whitelist_id', id)

    if (tokenError) {
      throw tokenError
    }

    // Then delete the whitelist entry
    const { error: whitelistError } = await supabaseClient
      .from('whitelist')
      .delete()
      .eq('id', id)

    if (whitelistError) {
      throw whitelistError
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
