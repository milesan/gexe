#!/bin/bash

echo "🚀 Deploying Supabase Functions..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

# Function to deploy with error handling
deploy_function() {
    local function_name=$1
    echo "📦 Deploying $function_name..."
    
    if supabase functions deploy $function_name; then
        echo "✅ Successfully deployed $function_name"
    else
        echo "❌ Failed to deploy $function_name"
        return 1
    fi
    echo ""
}

# Deploy functions
deploy_function "stripe-payment-webhook"
deploy_function "create-booking-securely"
deploy_function "validate-discount-code"

echo "🎉 Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Configure Stripe webhook in Stripe Dashboard"
echo "2. Add webhook endpoint: https://[YOUR-PROJECT].supabase.co/functions/v1/stripe-payment-webhook"
echo "3. Set environment variables in Supabase Dashboard"
echo "4. Test with a payment" 