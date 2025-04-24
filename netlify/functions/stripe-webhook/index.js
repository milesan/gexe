const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_PROD);

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

    // Verify API key
    const apiKey = event.headers.apikey;
    if (!apiKey || apiKey !== process.env.VITE_SUPABASE_ANON_KEY) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Invalid API key'
        })
      };
    }

    const { total, description } = JSON.parse(event.body);

    if (!total || !description) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Missing required fields'
        })
      };
    }

    const transactionDescription = "Donation to the Garden Associação, " + description;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      line_items: [{
        price_data: {
          currency: "eur",
          tax_behavior: "inclusive",
          unit_amount: total * 100,
          product_data: {
            name: transactionDescription,
          },
        },
        quantity: 1,
      }],
      mode: 'payment',
      automatic_tax: {enabled: true},
      redirect_on_completion: 'never',
      description: transactionDescription
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        clientSecret: session.client_secret
      })
    };
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message })
    };
  }
};