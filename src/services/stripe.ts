export async function redirectToCheckout(
  title: string,
  checkIn: Date,
  checkOut: Date,
  amount: number
) {
  console.log('[Stripe Frontend] Starting checkout:', {
    title,
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString(),
    amount
  });

  try {
    console.log('[Stripe Frontend] Loading Stripe instance...');
    const stripe = await stripePromise;
    if (!stripe) throw new Error('Stripe failed to load');
    console.log('[Stripe Frontend] Stripe instance loaded successfully');

    console.log('[Stripe Frontend] Creating checkout session with params:', {
      mode: 'payment',
      amount: amount * 100,
      title,
      dates: `${checkIn.toLocaleDateString()} to ${checkOut.toLocaleDateString()}`,
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/cancel`
    });

    const { error } = await stripe.redirectToCheckout({
      mode: 'payment',
      lineItems: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: title,
            description: `Stay from ${checkIn.toLocaleDateString()} to ${checkOut.toLocaleDateString()}`,
          },
          unit_amount: amount * 100, // Convert to cents
        },
        quantity: 1,
      }],
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/cancel`,
    });

    if (error) {
      console.error('[Stripe Frontend] Checkout redirect error:', {
        type: error.type,
        message: error.message,
        code: error.code
      });
      throw error;
    }

    console.log('[Stripe Frontend] Checkout redirect successful');
  } catch (err) {
    console.error('[Stripe Frontend] Error in checkout process:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    throw err;
  }
}

// Re-export the function with the expected name
export const createCheckoutSession = redirectToCheckout;