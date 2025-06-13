import React, { useState, useEffect } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getFrontendUrl } from '../lib/environment';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { createPortal } from 'react-dom';

// The public key stays the same, always loaded from Netlify environment variables
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Log the current environment for debugging purposes
console.log('[StripeCheckout] Current environment:', import.meta.env.MODE);

export interface StripeCheckoutFormProps {
  authToken: string;
  total: number;
  description: string;
  bookingDetails?: {
    accommodationId: string;
    accommodationTitle: string;
    checkIn: string;
    checkOut: string;
    userId?: string;
    appliedDiscountCode?: string;
    creditsUsed?: number;
  };
  onSuccess: (paymentIntentId?: string) => void;
  onClose: () => void;
  userEmail: string;
}

const CheckoutForm: React.FC<StripeCheckoutFormProps> = ({
  authToken,
  total,
  description,
  bookingDetails,
  onSuccess,
  onClose,
  userEmail,
}) => {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!stripe) {
      return;
    }

    const clientSecret = new URLSearchParams(window.location.search).get(
      "payment_intent_client_secret"
    );

    if (!clientSecret) {
      return;
    }

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      switch (paymentIntent?.status) {
        case "succeeded":
          setMessage("Payment succeeded!");
          onSuccess(paymentIntent.id);
          break;
        case "processing":
          setMessage("Your payment is processing.");
          break;
        case "requires_payment_method":
          setMessage("Your payment was not successful, please try again.");
          break;
        default:
          setMessage("Something went wrong.");
          break;
      }
    });
  }, [stripe, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${getFrontendUrl()}/confirmation`,
        receipt_email: userEmail,
      },
    });

    if (error.type === "card_error" || error.type === "validation_error") {
      setMessage(error.message || 'An unexpected error occurred.');
    } else {
      setMessage("An unexpected error occurred.");
    }

    setIsLoading(false);
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      <PaymentElement id="payment-element" />
      <button disabled={isLoading || !stripe || !elements} id="submit" className="w-full bg-accent-primary text-black p-3 font-mono hover:bg-accent-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6">
        <span id="button-text">
          {isLoading ? <div className="spinner" id="spinner"></div> : `Pay €${total.toFixed(2)}`}
        </span>
      </button>
      {message && <div id="payment-message" className="font-mono text-red-500 text-sm mt-4 text-center">{message}</div>}
    </form>
  );
};

export const StripeCheckoutForm: React.FC<StripeCheckoutFormProps> = (props) => {
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    if (props.total > 0) {
      fetch(`${import.meta.env.VITE_BACKEND_URL}/create-payment-intent`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${props.authToken}`
        },
        body: JSON.stringify({ 
          amount: props.total * 100, // convert to cents
          description: props.description,
          bookingDetails: props.bookingDetails,
          receipt_email: props.userEmail,
        }),
      })
      .then((res) => res.json())
      .then((data) => setClientSecret(data.clientSecret))
      .catch(error => console.error("Failed to create payment intent:", error));
    }
  }, [props.total, props.description, props.authToken, props.bookingDetails, props.userEmail]);

  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#A3FFD5',
      colorBackground: '#1E1E1E',
      colorText: '#FFFFFF',
      colorDanger: '#DF1B41',
      fontFamily: 'Ideal Sans, system-ui, sans-serif',
      spacingUnit: '2px',
      borderRadius: '4px',
    }
  };
  const options = {
    clientSecret,
    appearance,
  };

  console.log('[StripeCheckout] Rendering as portal outside normal component hierarchy');

  const checkoutContent = (
    <div className="Stripe">
      {clientSecret && (
        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm {...props} />
        </Elements>
      )}
    </div>
  );
  
  // Render our component at the document root, outside of any other stacking contexts
  return createPortal(checkoutContent, document.body);
}