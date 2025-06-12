# Stripe Webhook Setup Guide

## Overview
This guide explains how to set up the Stripe webhook to properly handle booking confirmations after payment.

## The Problem We Fixed
Previously, bookings were created client-side after payment, which meant:
- If user closed browser after payment → No booking created
- If network failed → No booking created  
- If JavaScript errored → No booking created
- **Result: Stripe had the money, but no booking was recorded!**

## The New Flow
1. User clicks "Confirm Booking"
2. System creates a "pending" booking in database
3. User pays via Stripe
4. Stripe sends webhook to our server
5. Server confirms the booking and sends email
6. Frontend shows confirmation

## Setup Steps

### 1. Deploy the Functions
Make sure these Supabase functions are deployed:
- `create-pending-booking` - Creates pending bookings before payment
- `stripe-webhook-handler` - Handles Stripe webhooks
- `stripe-webhook` - Creates Stripe sessions (updated)
- `send-booking-confirmation` - Sends confirmation emails

### 2. Set Environment Variables
In your Supabase dashboard, set these environment variables:

```bash
# Production Stripe keys
STRIPE_SECRET_KEY_PRODUCTION=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Development Stripe keys (for testing)
STRIPE_SECRET_KEY_DEVELOPMENT=sk_test_...

# Email service
RESEND_API_KEY=re_...
```

### 3. Configure Stripe Webhook
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set the endpoint URL:
   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/stripe-webhook-handler
   ```
4. Select events to listen to:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copy the webhook signing secret and add it as `STRIPE_WEBHOOK_SECRET` in Supabase

### 4. Run Database Migration
Apply the migration to add necessary fields:
```bash
supabase db push
```

### 5. Test the Flow
1. Make a test booking
2. Check that a pending booking is created in the database
3. Complete payment
4. Verify the booking status changes to "confirmed"
5. Check that confirmation email is sent

## Monitoring

### Check Webhook Logs
In Stripe Dashboard → Webhooks → Your endpoint → View logs

### Check Function Logs
In Supabase Dashboard → Functions → Select function → View logs

### Common Issues

**Webhook signature verification failed**
- Make sure `STRIPE_WEBHOOK_SECRET` matches the one from Stripe dashboard

**Booking not confirming**
- Check that pending booking was created
- Verify webhook is reaching your endpoint
- Check function logs for errors

**Email not sending**
- Verify `RESEND_API_KEY` is set correctly
- Check send-booking-confirmation function logs

## Rollback Plan
If issues occur, you can temporarily revert to the old flow by:
1. Commenting out the pending booking creation in `handleConfirmClick`
2. Using the old `handleBookingSuccess` logic
3. But remember: this brings back the risk of lost bookings!

## Security Notes
- Webhook endpoint verifies Stripe signatures
- Only pending bookings can be confirmed
- Payment intent IDs prevent duplicate bookings
- Old pending bookings are automatically cancelled after 1 hour