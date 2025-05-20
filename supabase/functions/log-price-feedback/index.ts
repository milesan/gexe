import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface PriceFeedbackPayload {
  selected_option: 'steep' | 'fair' | 'cheap';
  booking_context: Record<string, any>; // JSONB, so flexible
  frontend_url?: string;
}

serve(async (req) => {
  console.log('[log-price-feedback] Function called');

  if (req.method === 'OPTIONS') {
    console.log('[log-price-feedback] Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('BACKEND_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[log-price-feedback] Missing environment variables: BACKEND_URL or SUPABASE_SERVICE_ROLE_KEY');
      throw new Error('Server configuration error.');
    }

    const supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json() as PriceFeedbackPayload;
    console.log('[log-price-feedback] Received payload:', body);

    if (!body.selected_option || !['steep', 'fair', 'cheap'].includes(body.selected_option)) {
      console.warn('[log-price-feedback] Invalid selected_option:', body.selected_option);
      return new Response(JSON.stringify({ error: 'Invalid selected_option. Must be steep, fair, or cheap.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!body.booking_context || typeof body.booking_context !== 'object') {
      console.warn('[log-price-feedback] Invalid booking_context:', body.booking_context);
      return new Response(JSON.stringify({ error: 'Invalid booking_context. Must be a JSON object.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    let userId = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser(token);
        if (userError) {
          console.warn('[log-price-feedback] Error fetching user from token:', userError.message);
          // Don't throw, just log. Feedback can still be anonymous.
        } else if (user) {
          userId = user.id;
          console.log('[log-price-feedback] User identified:', userId);
        }
      } catch (e) {
        console.warn('[log-price-feedback] Error processing auth token:', e.message);
      }
    }

    const feedbackData = {
      user_id: userId,
      selected_option: body.selected_option,
      booking_context: body.booking_context,
      frontend_url: body.frontend_url || req.headers.get('origin') || 'unknown',
    };

    console.log('[log-price-feedback] Attempting to insert feedback:', feedbackData);
    const { error: insertError } = await supabaseAdminClient
      .from('price_feedback')
      .insert(feedbackData);

    if (insertError) {
      console.error('[log-price-feedback] Error inserting feedback into database:', insertError);
      throw insertError;
    }

    console.log('[log-price-feedback] Feedback logged successfully.');
    return new Response(JSON.stringify({ message: 'Feedback logged successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[log-price-feedback] Unhandled error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
        stack: error.stack,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.status || 500, // Use status from error if available, otherwise 500
      }
    );
  }
}); 