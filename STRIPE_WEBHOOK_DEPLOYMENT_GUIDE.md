# Stripe Webhook Deployment Guide

This guide addresses the issues where Stripe payments are successful but bookings are not created in Supabase and confirmation emails are not sent.

## Issues Fixed

1. **Missing Stripe Webhook Handler**: Created a proper webhook handler (`stripe-payment-webhook`) to process successful payments
2. **Booking Creation**: The webhook now creates bookings in Supabase when payments are completed
3. **Email Confirmation**: Both the webhook and `create-booking-securely` function now send confirmation emails

## Changes Made

### 1. New Stripe Payment Webhook Function
- **Location**: `supabase/functions/stripe-payment-webhook/index.ts`
- **Purpose**: Listens for Stripe `checkout.session.completed` events and creates bookings
- **Features**:
  - Verifies webhook signatures for security
  - Supports both production and development environments
  - Extracts booking details from payment intent description
  - Creates booking in database
  - Sends confirmation email
  - Prevents duplicate bookings using `payment_intent_id`

### 2. Updated Create Booking Securely Function
- **Location**: `supabase/functions/create-booking-securely/index.ts`
- **Change**: Fixed the TODO comment and implemented confirmation email sending
- **Impact**: Bookings created through the normal flow now also send emails

### 3. Test Script
- **Location**: `scripts/test-stripe-webhook.ts`
- **Purpose**: Test webhook functionality locally

## Deployment Steps

### 1. Environment Variables
Ensure these are set in your Supabase Edge Functions:
```
STRIPE_SECRET_KEY_PRODUCTION
STRIPE_SECRET_KEY_DEVELOPMENT
STRIPE_WEBHOOK_SECRET_PRODUCTION
STRIPE_WEBHOOK_SECRET_DEVELOPMENT
RESEND_API_KEY
FRONTEND_URL (or APP_URL)
```

### 2. Deploy Edge Functions
```bash
# Deploy the new webhook handler
supabase functions deploy stripe-payment-webhook

# Deploy the updated create-booking-securely function
supabase functions deploy create-booking-securely
```

### 3. Configure Stripe Webhooks

#### For Production:
1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set endpoint URL: `https://[YOUR-SUPABASE-PROJECT].supabase.co/functions/v1/stripe-payment-webhook`
4. Select events: `checkout.session.completed`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET_PRODUCTION` environment variable

#### For Development:
1. Use Stripe CLI:
```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-payment-webhook
```
2. Copy the webhook signing secret displayed

### 4. Test the Integration

#### Local Testing:
```bash
# Set environment variables
export STRIPE_SECRET_KEY_DEVELOPMENT=your_test_key
export STRIPE_WEBHOOK_SECRET_DEVELOPMENT=your_webhook_secret

# Run the test script
npx tsx scripts/test-stripe-webhook.ts
```

#### Production Testing:
1. Make a test booking with Stripe test card: `4242 4242 4242 4242`
2. Check Supabase logs for webhook processing
3. Verify booking appears in database
4. Check if confirmation email was received

## Monitoring

### Check Webhook Logs:
```sql
-- In Supabase SQL Editor
SELECT * FROM edge_logs 
WHERE metadata->>'function_name' = 'stripe-payment-webhook'
ORDER BY created_at DESC;
```

### Verify Bookings:
```sql
-- Check recent bookings with payment intent IDs
SELECT id, user_id, total_price, payment_intent_id, created_at
FROM bookings
WHERE payment_intent_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Check Email Logs:
```sql
-- Check booking confirmation email logs
SELECT * FROM edge_logs 
WHERE metadata->>'function_name' = 'send-booking-confirmation'
ORDER BY created_at DESC;
```

## Troubleshooting

### If bookings are not being created:
1. Check Stripe webhook logs in Stripe Dashboard
2. Verify webhook signature is correct
3. Check Supabase Edge Function logs for errors
4. Ensure user exists in database with the payment email

### If emails are not being sent:
1. Verify RESEND_API_KEY is set correctly
2. Check email function logs for errors
3. Ensure email templates are properly configured
4. Verify the `confirmation_email_sent` flag in bookings table

## Important Notes

1. The webhook extracts booking details from the payment description format: 
   `"email@example.com, Accommodation Title for X nights from DD. Month"`

2. The system prevents duplicate bookings by using the `payment_intent_id` as a unique constraint

3. Both production and development environments are supported with separate Stripe keys

4. The webhook will only process payments with status 'paid'

## Future Improvements

1. Add webhook retry logic for failed attempts
2. Implement better error handling and alerting
3. Add support for payment refunds/cancellations
4. Store more payment metadata for reconciliation 