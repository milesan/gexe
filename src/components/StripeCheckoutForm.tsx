import { useState, useEffect, useCallback } from "react";
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { createPortal } from 'react-dom';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface Props {
  description: string;
  total: number;
  authToken: string;
  onSuccess: () => Promise<void>;
}

export function StripeCheckoutForm({ total, authToken, description, onSuccess }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // When component mounts, add a class to body to prevent scrolling and hide the header
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    // Find and hide the header
    const header = document.querySelector('header');
    if (header) {
      console.log('[StripeCheckout] Found header, hiding it temporarily');
      header.style.display = 'none';
    } else {
      console.warn('[StripeCheckout] Could not find header element');
    }
    
    // Clean up when component unmounts
    return () => {
      document.body.style.overflow = '';
      
      // Restore the header
      const header = document.querySelector('header');
      if (header) {
        header.style.display = '';
      }
    };
  }, []);

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

  console.log('[StripeCheckout] Rendering as portal outside normal component hierarchy');

  const checkoutContent = (
    <div 
      style={{ 
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999,
        isolation: 'isolate'
      }}
    >
      <div 
        id="checkout" 
        style={{ 
          position: 'relative',
          width: '100%', 
          maxWidth: '500px',
          maxHeight: '90vh', 
          overflow: 'auto',
          padding: '20px',
          margin: '0 auto',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          zIndex: 999999
        }}
      >
        <div style={{ position: 'relative', zIndex: 999999 }}>
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
      </div>
    </div>
  );
  
  // Render our component at the document root, outside of any other stacking contexts
  return createPortal(checkoutContent, document.body);
}