import { useState, useEffect, useCallback } from "react";
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface Props {
  description: string;
  total: number;
  authToken: string;
  onSuccess: () => Promise<void>;
}

export function StripeCheckoutForm({ total, authToken, description, onSuccess }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    const fetchSecret = async () => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`, {
        method: "POST",
        mode: 'cors',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ total, description }),
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
    };
    fetchSecret();
  }, [authToken, total, description]);

  const handleCheckoutComplete = useCallback(async () => {
    console.log('[StripeCheckout] Payment completed, checking status...');
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook-status`, {
      method: "POST",
      mode: 'cors',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientSecret }),
    });
    const { status } = await response.json();
    
    if (status === 'paid') {
      console.log('[StripeCheckout] Payment confirmed, proceeding with booking...');
      await onSuccess();
    } else {
      console.error('[StripeCheckout] Payment status not paid:', status);
    }
  }, [authToken, clientSecret, onSuccess]);

  if (!clientSecret) {
    return <div>Loading checkout...</div>;
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{
          clientSecret,
          onComplete: handleCheckoutComplete,
        }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}