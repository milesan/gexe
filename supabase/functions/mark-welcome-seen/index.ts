import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Mark Welcome Seen function booting up...');

serve(async (req) => {
  console.log('[mark-welcome-seen] Request received:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('[mark-welcome-seen] Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('[mark-welcome-seen] Supabase admin client initialized.');

    // Get the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header.');
    }
    
    // Create a Supabase client with the user's token to get their ID
    const userSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Use anon key
        { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('[mark-welcome-seen] Error getting user from JWT:', userError);
      throw new Error('Failed to get authenticated user.');
    }

    const userId = user.id;
    console.log('[mark-welcome-seen] Authenticated User ID:', userId);

    const { data, error: updateError } = await supabaseAdminClient.auth.admin.updateUserById(
      userId,
      { data: { has_seen_welcome: true } } // Ensure this matches your metadata field
    );

    if (updateError) {
      console.error('[mark-welcome-seen] Error updating user metadata:', updateError);
      throw updateError;
    }

    console.log('[mark-welcome-seen] User metadata updated successfully for user_id:', userId, data);
    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[mark-welcome-seen] Handler error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 