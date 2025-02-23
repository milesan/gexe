import { loadStripe, Stripe } from '@stripe/stripe-js';
import { PaymentDetails, PaymentIntent, CheckoutSession, StripeError } from './types';

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY_PROD;
const API_URL = import.meta.env.VITE_API_URL;

class StripeService {
  private static instance: StripeService;
  private stripe: Promise<Stripe | null>;

  private constructor() {
    this.stripe = loadStripe(STRIPE_PUBLIC_KEY);
    console.log('[Stripe Service] Initializing with key:', STRIPE_PUBLIC_KEY ? 'Present' : 'Missing');
  }

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  public async getStripe(): Promise<Stripe> {
    const stripe = await this.stripe;
    if (!stripe) throw new Error('Failed to initialize Stripe');
    return stripe;
  }

  public async createPaymentIntent(details: PaymentDetails): Promise<PaymentIntent> {
    try {
      console.log('[Stripe Service] Creating payment intent:', details);
      
      const response = await fetch(`${API_URL}/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const result = await response.json();
      console.log('[Stripe Service] Payment intent created:', result);
      
      return {
        id: result.id,
        clientSecret: result.client_secret,
        amount: result.amount,
        status: result.status,
        currency: result.currency,
      };
    } catch (error) {
      console.error('[Stripe Service] Failed to create payment intent:', error);
      throw this.handleError(error);
    }
  }

  public async createCheckoutSession(details: PaymentDetails): Promise<CheckoutSession> {
    try {
      console.log('[Stripe Service] Creating checkout session:', details);
      
      const response = await fetch(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const result = await response.json();
      console.log('[Stripe Service] Checkout session created:', result);
      
      return {
        id: result.id,
        url: result.url,
        paymentStatus: result.payment_status,
      };
    } catch (error) {
      console.error('[Stripe Service] Failed to create checkout session:', error);
      throw this.handleError(error);
    }
  }

  private handleError(error: any): StripeError {
    if (error.type) {
      return error as StripeError;
    }
    
    return {
      type: 'api_error',
      message: error.message || 'An unexpected error occurred',
    };
  }
}

export const stripeService = StripeService.getInstance();
