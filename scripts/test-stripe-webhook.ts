import Stripe from 'stripe';

// Test script for verifying Stripe webhook functionality
// Usage: npx tsx scripts/test-stripe-webhook.ts

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY_DEVELOPMENT || '';
const WEBHOOK_ENDPOINT_URL = 'http://localhost:54321/functions/v1/stripe-payment-webhook';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET_DEVELOPMENT || '';

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY_DEVELOPMENT environment variable is required');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

async function createTestPayment() {
  try {
    console.log('🚀 Creating test checkout session...');
    
    // Create a test checkout session
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: 5000, // €50.00
          product_data: {
            name: 'Test Booking - Your Own Tent for 7 nights from 5. August',
          },
        },
        quantity: 1,
      }],
      mode: 'payment',
      payment_intent_data: {
        description: 'test@example.com, Your Own Tent for 7 nights from 5. August'
      },
      customer_email: 'test@example.com',
    });

    console.log('✅ Checkout session created:', session.id);
    console.log('💳 Complete payment at:', session.url);
    
    // In a real test, you would complete the payment using Stripe's test card
    console.log('\n📝 To test the webhook:');
    console.log('1. Configure your webhook endpoint in Stripe Dashboard');
    console.log('2. Complete a test payment using card: 4242 4242 4242 4242');
    console.log('3. Check Supabase logs for webhook processing');
    
    return session;
  } catch (error) {
    console.error('❌ Error creating test payment:', error);
    throw error;
  }
}

async function simulateWebhookEvent(sessionId: string) {
  console.log('\n🔧 Simulating webhook event for session:', sessionId);
  
  try {
    // Retrieve the session to get payment details
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
    
    // Create a test webhook event
    const event = {
      id: 'evt_test_' + Date.now(),
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          ...session,
          payment_status: 'paid', // Simulate successful payment
        },
      },
      type: 'checkout.session.completed',
    };
    
    console.log('📤 Sending webhook event to:', WEBHOOK_ENDPOINT_URL);
    
    // Create webhook signature
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET || 'test_secret',
    });
    
    // Send to local endpoint
    const response = await fetch(WEBHOOK_ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
      body: payload,
    });
    
    const result = await response.text();
    console.log('📥 Webhook response:', response.status, result);
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${result}`);
    }
    
    console.log('✅ Webhook simulation successful!');
  } catch (error) {
    console.error('❌ Error simulating webhook:', error);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('🧪 Stripe Webhook Test Script');
  console.log('================================\n');
  
  try {
    // Create a test session
    const session = await createTestPayment();
    
    // Wait a moment for the session to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate the webhook (only in development)
    if (process.env.NODE_ENV !== 'production') {
      await simulateWebhookEvent(session.id);
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Check Supabase Edge Function logs for webhook processing');
    console.log('2. Verify booking was created in the database');
    console.log('3. Check if confirmation email was sent');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error); 