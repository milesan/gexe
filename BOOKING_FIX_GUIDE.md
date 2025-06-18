# Booking System Fix Guide

## Current Issues
1. **CORS Error**: The frontend is calling Supabase edge functions but getting CORS errors
2. **No Webhook Handler**: Stripe payments succeed but bookings aren't created if the browser fails
3. **No Email Confirmations**: Since bookings fail, emails never get sent

## Immediate Fix (Implemented)
I've switched your frontend to use Netlify functions instead of Supabase edge functions:
- Created `/netlify/functions/stripe-webhook-status/` to check payment status
- Updated `StripeCheckoutForm.tsx` to call `/.netlify/functions/*` instead of Supabase

This should fix the CORS error immediately.

## Proper Solution: Stripe Webhooks

### Step 1: Configure Stripe Webhook
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.netlify.app/.netlify/functions/stripe-webhook-receiver`
3. Select events: `checkout.session.completed`
4. Copy the webhook signing secret

### Step 2: Add Environment Variables
Add to Netlify:
```
STRIPE_WEBHOOK_SECRET=whsec_xxxxx (from step 1)
SUPABASE_SERVICE_ROLE_KEY=xxxxx (from Supabase settings)
```

### Step 3: Create Webhook Handler
Create `/netlify/functions/stripe-webhook-receiver/index.js`:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_PROD);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const metadata = session.metadata;
    
    // Create booking using metadata
    const { error } = await supabase
      .from('bookings')
      .insert({
        user_id: metadata.userId,
        accommodation_id: metadata.accommodationId,
        check_in: metadata.checkIn,
        check_out: metadata.checkOut,
        total_price: session.amount_total / 100,
        status: 'confirmed',
        payment_intent_id: session.payment_intent
      });
      
    if (!error) {
      // Send confirmation email
      await supabase.functions.invoke('send-booking-confirmation', {
        body: { 
          email: metadata.email,
          // ... other details
        }
      });
    }
  }

  return { statusCode: 200, body: 'OK' };
};
```

### Step 4: Update Checkout Session Creation
I've already updated your code to pass booking details as metadata when creating the Stripe session.

## Testing the Fix

### Test CORS Fix (Immediate):
1. Deploy the changes
2. Try making a booking - the CORS error should be gone
3. Bookings should be created again (though still dependent on frontend)

### Test Webhook (After Implementation):
1. Use Stripe CLI: `stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook-receiver`
2. Make a test payment
3. Check logs for webhook processing
4. Verify booking created in Supabase
5. Check email sent

## Alternative: Use Supabase Edge Functions
If you prefer Supabase edge functions:
1. Deploy them: `supabase functions deploy`
2. Check CORS configuration in Supabase dashboard
3. Ensure proper authentication headers are included

## Reconciliation for Lost Bookings
Run this SQL to find payments without bookings:
```sql
-- Find successful Stripe payments without corresponding bookings
-- You'll need to cross-reference with Stripe dashboard
SELECT * FROM bookings 
WHERE created_at > '2024-12-01' 
ORDER BY created_at DESC;
```

Then manually check Stripe dashboard for payments around the same time without matching bookings.