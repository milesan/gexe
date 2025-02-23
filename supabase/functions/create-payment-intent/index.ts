// Import Stripe
import Stripe from "https://esm.sh/stripe@12.0.0";

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

console.log("[Supabase Create Payment Intent] Stripe Payment Intent Function Initialized!");
console.log("[Supabase Create Payment Intent] Using Stripe API Version:", stripe.getApiField("version"));

Deno.serve(async (req) => {
  console.log("[Supabase Create Payment Intent] Received new request");
  console.log("[Supabase Create Payment Intent] Request method:", req.method);
  console.log("[Supabase Create Payment Intent] Request headers:", Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, Accept',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const { total, description } = await req.json();
    console.log("[Supabase Create Payment Intent] Request data:", { total, description });

    if (!total || total <= 0) {
      console.log("[Supabase Create Payment Intent] Invalid amount detected:", total);
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Accept"
        },
      });
    }

    console.log("[Supabase Create Payment Intent] Creating payment intent for amount:", total * 100, "cents");
    // Create a Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total * 100, // Convert dollars to cents
      currency: "usd",
      description,
    });

    console.log("[Supabase Create Payment Intent] Successfully created payment intent:", {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status
    });

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Accept"
        },
      }
    );
  } catch (error) {
    console.error("[Supabase Create Payment Intent] Error details:", {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Accept"
      },
    });
  }
});
