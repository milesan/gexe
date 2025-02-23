import { useState, useCallback } from 'react';
import { PaymentDetails, StripeError } from '../services/stripe/types';
import { stripeService } from '../services/stripe/api';

interface UseStripePaymentProps {
  onSuccess?: () => void;
  onError?: (error: StripeError) => void;
}

export function useStripePayment({ onSuccess, onError }: UseStripePaymentProps = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StripeError | null>(null);

  const handlePayment = useCallback(async (details: PaymentDetails) => {
    setLoading(true);
    setError(null);

    try {
      console.log('[Stripe Hook] Initiating payment:', details);

      // Create checkout session
      const session = await stripeService.createCheckoutSession(details);
      console.log('[Stripe Hook] Checkout session created:', session);

      // Redirect to Stripe checkout
      window.location.href = session.url;
      
      onSuccess?.();
    } catch (err) {
      console.error('[Stripe Hook] Payment failed:', err);
      const stripeError = err as StripeError;
      setError(stripeError);
      onError?.(stripeError);
    } finally {
      setLoading(false);
    }
  }, [onSuccess, onError]);

  return {
    handlePayment,
    loading,
    error,
  };
}
