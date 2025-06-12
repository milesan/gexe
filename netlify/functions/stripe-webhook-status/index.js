const stripe = require('stripe')(process.env.VITE_STRIPE_SECRET_KEY);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  try {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS
      };
    }

    // Parse body
    const { clientSecret } = JSON.parse(event.body);
    
    if (!clientSecret) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "clientSecret is required" })
      };
    }
    
    // Extract session ID from clientSecret
    const sessionId = clientSecret.split('_secret_')[0];
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: session.payment_status })
    };
  } catch (error) {
    console.error('Stripe status check error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message })
    };
  }
};