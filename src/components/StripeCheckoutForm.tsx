import { useCallback, useState } from "react";
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY_PROD);

interface Props {
  description: string,
  total: number,
  authToken: string
}

export function StripeCheckoutForm({ total, authToken, description }: Props) {
  const fetchClientSecret = useCallback(() => {
    // Create a Checkout Session
    return fetch(import.meta.env.VITE_SUPABASE_URL + "/functions/v1/stripe-webhook", {
      method: "POST",
      mode: 'cors',
      headers: {
        Authorization: 'Bearer ' + authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ total, description })
    })
      .then((res) => res.json())
      .then((data) => data.clientSecret);
  }, []);

  const options = {fetchClientSecret};

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={options}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}