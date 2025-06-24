import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';

// Initialize logging function for consistent logging across functions
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = data ? 
    `[${timestamp}] STRIPE-STATUS: ${message} ${JSON.stringify(data, null, 2)}` : 
    `[${timestamp}] STRIPE-STATUS: ${message}`;
  console.log(logEntry);
};

// Initialize Stripe with appropriate key based on environment parameter
const getStripeKey = (clientEnvironment: string | undefined) => {
  // Use the client environment or default to 'production' if not provided
  const environment = clientEnvironment ? 
    clientEnvironment.toLowerCase() : 
    'production'; // Default to production if not specified
  
  log(`Using environment: ${environment}`);
  
  // Construct the environment-specific key name based on request environment
  // Production uses PRODUCTION key, everything else uses DEVELOPMENT key
  const keyName = environment === 'production' ? 
    'STRIPE_SECRET_KEY_PRODUCTION' : 
    'STRIPE_SECRET_KEY_DEVELOPMENT';
  
  log(`Looking for Stripe key: ${keyName}`);
  
  const stripeKey = Deno.env.get(keyName);
  
  if (!stripeKey) {
    log(`ERROR: Missing ${keyName} environment variable for '${environment}' environment`);
    return ''; // Return empty string if key is not found
  }
  
  return stripeKey;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-timezone',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  const requestId = crypto.randomUUID();
  log(`Received status request ${requestId}`, { 
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  if (req.method === 'OPTIONS') {
    log(`OPTIONS request ${requestId} - returning CORS response`);
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    log(`Processing request ${requestId} - parsing request body`);
    const body = await req.json();
    log(`Request ${requestId} body parsed`, body);
    
    const { clientSecret, environment } = body;
    
    if (!clientSecret) {
      log(`ERROR: Missing clientSecret in request ${requestId}`, body);
      return new Response(JSON.stringify({ error: "clientSecret is required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }
    
    // Get the appropriate Stripe key based on environment
    const stripeKey = getStripeKey(environment);
    
    // Initialize Stripe with the selected key
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });
    
    log(`Retrieving session for request ${requestId}`, { clientSecret: clientSecret.substring(0, 10) + '...' });
    
    const sessionId = clientSecret.split('_secret_')[0]; // Extract session ID from clientSecret
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    log(`Session retrieved for request ${requestId}`, { 
      sessionId: sessionId,
      paymentStatus: session.payment_status,
      paymentIntentId: session.payment_intent
    });
    
    return new Response(JSON.stringify({ 
      status: session.payment_status,
      paymentIntentId: session.payment_intent 
    }), {
      headers: corsHeaders,
      status: 200,
    });
  } catch (error) {
    log(`ERROR in request ${requestId}`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code || null,
      type: error.type || null,
      statusCode: error.statusCode || null,
      param: error.param || null,
    });
    
    return new Response(JSON.stringify({ 
      error: error.message,
      type: error.type || null,
      code: error.code || null
    }), {
      headers: corsHeaders,
      status: error.statusCode || 400,
    });
  }
});