import { Stripe } from '@stripe/stripe-js';

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  status: string;
  currency: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  paymentStatus: string;
}

export interface PaymentDetails {
  amount: number;
  currency: string;
  description: string;
  metadata: {
    bookingId: string;
    userId: string;
    accommodationId: string;
  };
}

export interface StripeError {
  type: 'api_error' | 'card_error' | 'validation_error';
  message: string;
  code?: string;
}
