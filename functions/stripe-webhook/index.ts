import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json'
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*'
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_PROD') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
    
  console.log('[Stripe Webhook] Received request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log('[Stripe Webhook] Handling CORS preflight request');
    return new Response('ok', { headers: CORS_HEADERS, status: 200 })
  }

  // Verify API key
  const apiKey = req.headers.get('apikey');
  console.log('[Stripe Webhook] Verifying API key:', apiKey ? 'Present' : 'Missing');
  
  if (!apiKey || apiKey !== Deno.env.get('ANON_KEY')) {
    console.log('[Stripe Webhook] Invalid API key');
    return new Response(
      JSON.stringify({ 
        error: 'Unauthorized',
        message: 'Invalid API key'
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401 
      }
    );
  }

  // Handle stripe checkout
  try {
    const body = await req.json();
    console.log('[Stripe Webhook] Request body:', body);
    
    const { total, description } = body;

    if (!total || !description) {
      console.log('[Stripe Webhook] Missing required fields:', { total, description });
      throw new Error('Missing required fields');
    }
    
    console.log('[Stripe Webhook] Creating checkout session:', {
      amount: total * 100,
      description
    });
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      amount: total * 100,
      currency: 'eur',
      description: description,
      payment_intent_data: {
        capture_method: 'automatic',
      },
    });

    console.log('[Stripe Webhook] Checkout session created:', {
      id: session.id,
      clientSecret: session.client_secret ? 'Present' : 'Missing'
    });

    return new Response(JSON.stringify({clientSecret: session.client_secret}), {
      headers: CORS_HEADERS,
      status: 200,
    })
  } catch (error) {
    console.error('[Stripe Webhook] Error:', {
      message: error.message,
      stack: error.stack,
      type: error.type,
      code: error.code
    });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: CORS_HEADERS,
      status: 400,
    })
  }
})