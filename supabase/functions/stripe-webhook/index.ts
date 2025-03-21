import { serve } from 'https://deno.land/std@0.204.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno&deno-version=1.45.2';

// Initialize logging function
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = data ? 
    `[${timestamp}] STRIPE-WEBHOOK: ${message} ${JSON.stringify(data, null, 2)}` : 
    `[${timestamp}] STRIPE-WEBHOOK: ${message}`;
  console.log(logEntry);
};

log('Function starting - initializing Stripe client');

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
  log(`Received request ${requestId}`, { 
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
    
    // Extract environment from request body
    const { total, description, environment } = body;
    
    // Get the appropriate Stripe key based on environment
    const stripeKey = getStripeKey(environment);
    
    // Initialize Stripe with the selected key
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });
    
    if (total === undefined) {
      log(`ERROR: Request ${requestId} missing 'total' parameter`, body);
      return new Response(JSON.stringify({ error: "'total' is required" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    if (!description) {
      log(`WARNING: Request ${requestId} missing 'description' parameter`, body);
    }

    log(`Creating Stripe checkout session for request ${requestId}`, {
      environment,
      total,
      description,
      amountInCents: total * 100
    });

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      line_items: [{
        price_data: {
          currency: "eur",
          tax_behavior: "inclusive",
          unit_amount: Math.round(total * 100),
          product_data: { name: "Donation to the Garden Associação, " + description },
        },
        quantity: 1,
      }],
      mode: 'payment',
      automatic_tax: { enabled: true },
      redirect_on_completion: 'never', // Keep embedded flow
    });

    log(`Successfully created Stripe session for request ${requestId}`, {
      sessionId: session.id,
      hasClientSecret: !!session.client_secret
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
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