# GitHub Deployment Setup for Supabase Functions

## Prerequisites
- Your project is connected to GitHub ✓
- You have admin access to the GitHub repository
- You have your Supabase project details

## Step 1: Get Your Supabase Credentials

### Get Project Reference ID:
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → General
4. Copy the "Reference ID" (looks like: `abcdefghijklmnop`)

### Get Access Token:
1. Go to [Supabase Account](https://app.supabase.com/account/tokens)
2. Click "Generate new token"
3. Give it a name like "GitHub Actions"
4. Copy the token (you won't see it again!)

## Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add these secrets:

| Secret Name | Value |
|------------|-------|
| `SUPABASE_PROJECT_REF` | Your project reference ID |
| `SUPABASE_ACCESS_TOKEN` | Your access token |

## Step 3: Deploy

### Option A: Manual Deployment
1. Go to Actions tab in your GitHub repository
2. Find "Deploy Supabase Functions" workflow
3. Click "Run workflow"
4. Select branch and click "Run workflow"

### Option B: Automatic Deployment
The functions will automatically deploy when you:
- Push changes to `supabase/functions/**` on the main branch
- Merge a PR that modifies function files

## Step 4: Verify Deployment

1. Check the Actions tab for deployment status
2. Go to Supabase Dashboard → Edge Functions
3. Verify both functions appear:
   - `stripe-payment-webhook`
   - `create-booking-securely`

## Step 5: Set Function Environment Variables

In Supabase Dashboard → Edge Functions → [Function Name] → Settings:

### For stripe-payment-webhook:
```
STRIPE_SECRET_KEY_PRODUCTION=sk_live_...
STRIPE_SECRET_KEY_DEVELOPMENT=sk_test_...
STRIPE_WEBHOOK_SECRET_PRODUCTION=whsec_...
STRIPE_WEBHOOK_SECRET_DEVELOPMENT=whsec_...
SUPABASE_SERVICE_ROLE_KEY=[auto-populated]
SUPABASE_URL=[auto-populated]
```

### For create-booking-securely:
```
SUPABASE_SERVICE_ROLE_KEY=[auto-populated]
SUPABASE_URL=[auto-populated]
FRONTEND_URL=https://in.thegarden.pt
```

### For send-booking-confirmation:
```
RESEND_API_KEY=re_...
BACKEND_URL=[your-supabase-url]
FRONTEND_URL=https://in.thegarden.pt
```

## Step 6: Configure Stripe Webhook

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Endpoint URL: `https://[YOUR-PROJECT-REF].supabase.co/functions/v1/stripe-payment-webhook`
4. Select events: `checkout.session.completed`
5. Copy the signing secret
6. Add it as `STRIPE_WEBHOOK_SECRET_PRODUCTION` in Supabase

## Troubleshooting

### If deployment fails:
- Check GitHub Actions logs for errors
- Ensure secrets are correctly set
- Verify your Supabase project is active

### If functions don't appear:
- Wait 1-2 minutes for propagation
- Refresh Supabase Dashboard
- Check Edge Functions logs

## Testing

After deployment, test with:
```bash
curl https://[YOUR-PROJECT-REF].supabase.co/functions/v1/stripe-payment-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

You should get a response indicating the webhook is active. 