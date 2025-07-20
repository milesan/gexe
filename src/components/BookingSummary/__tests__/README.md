# BookingSummary Test Suite

## Overview

This comprehensive test suite covers the complex booking flow in the BookingSummary component, which orchestrates payment processing, pricing calculations, error recovery, and webhook coordination.

## What's Tested

### 1. Core Booking Flow (BookingSummary.test.tsx)
- **Basic rendering and display logic**
- **Pricing calculations and breakdowns**
- **Flexible check-in date validation**
- **Regular booking flow (Steps 1-9)**
- **Credits-only booking flow**
- **Admin booking flow**
- **Discount code integration**
- **Food contribution slider**
- **State management**
- **Modal interactions**
- **Loading states**

### 2. Integration Flow Testing (BookingFlow.integration.test.tsx)
- **Complete end-to-end booking scenarios**
- **Multi-step flow coordination**
- **Error recovery between steps**
- **Webhook coordination**
- **Payment/booking failure handling**
- **Test accommodation special handling**
- **Multi-week booking with discounts**

### 3. Pricing Calculation Logic (PricingCalculations.test.ts)
- **Duration discount calculations (1, 2, 4, 8+ weeks)**
- **Discount code applications (total, accommodation, food_facilities)**
- **Food contribution adjustments**
- **Test accommodation pricing overrides**
- **VAT calculations (24%)**
- **Edge cases and validation**
- **Rounding and precision**

### 4. Error Handling & Recovery (ErrorHandling.test.tsx)
- **Network and service failures**
- **Payment success but booking creation failure**
- **Webhook coordination failures**
- **Authentication and authorization failures**
- **Data validation failures**
- **Concurrency and race conditions**
- **Component unmounting during async operations**

## Test Setup

### Prerequisites
```bash
npm install vitest @testing-library/react @testing-library/jest-dom
```

### Configuration
The test setup includes:
- Mock environment variables
- Mock window objects for navigation
- Console output suppression
- Helper factories for test data
- Pre-configured scenarios

### Running Tests
```bash
# Run all BookingSummary tests
npm run test -- src/components/BookingSummary/__tests__

# Run specific test file
npm run test -- BookingSummary.test.tsx

# Run with coverage
npm run test:coverage -- src/components/BookingSummary

# Run in watch mode during development
npm run test:watch -- BookingSummary
```

## Test Scenarios Covered

### Happy Path Scenarios
✅ **Regular 1-week booking**
- Select accommodation → Validate availability → Create pending payment → Process Stripe payment → Create booking → Update payment record → Navigate to confirmation

✅ **Credits-only booking**
- Same flow but skips Stripe modal when credits cover full amount

✅ **Admin booking**
- Skips payment processing entirely for admin users

✅ **Multi-week booking with duration discounts**
- 2+ weeks: 8% discount
- 4+ weeks: 18% discount  
- 8+ weeks: 25% discount

### Error Recovery Scenarios
🔥 **Payment succeeds but booking creation fails**
- Attempts confirmation email
- Checks if webhook created booking
- Sends admin alert if booking doesn't exist
- Manually deducts credits if used
- Navigates to confirmation page anyway

🔥 **Webhook coordination**
- Frontend booking fails but webhook succeeds
- Avoids duplicate admin alerts
- Handles timing race conditions

🔥 **Network/service failures**
- Availability service down
- Database connection issues
- Stripe service unavailable
- Email service failures

### Edge Cases
⚡ **Fractional week calculations**
⚡ **High-value bookings (€5000+)**
⚡ **Test accommodation special pricing**
⚡ **Rapid-fire booking attempts**
⚡ **Session expiry during booking**
⚡ **Invalid data handling**

## Pricing Test Cases

### Duration Discounts
```typescript
// 1 week: 0% discount
expect(result.durationDiscountPercent).toBe(0);

// 2 weeks: 8% discount
expect(result.durationDiscountPercent).toBe(8);

// 4 weeks: 18% discount
expect(result.durationDiscountPercent).toBe(18);

// 8+ weeks: 25% discount
expect(result.durationDiscountPercent).toBe(25);
```

### Discount Code Applications
```typescript
// 20% off total
appliedDiscount: { code: 'SAVE20', percentage_discount: 20, applies_to: 'total' }
// Result: €545 → €436

// 10% off accommodation only
appliedDiscount: { code: 'ACC10', percentage_discount: 10, applies_to: 'accommodation' }
// Result: €200 accommodation → €180, total €525

// 15% off food & facilities only
appliedDiscount: { code: 'FOOD15', percentage_discount: 15, applies_to: 'food_facilities' }
// Result: €345 food → €293.25, total €493.25
```

### VAT Calculations
```typescript
// 24% VAT on all amounts
const vatAmount = totalAmount * 0.24;
const totalWithVat = totalAmount + vatAmount;
```

## Mock Scenarios

The test suite includes pre-configured scenarios:

```typescript
import { configureMocksForScenario, TEST_SCENARIOS } from './setup';

// Configure for credits-only booking
const { hooks, services } = configureMocksForScenario(TEST_SCENARIOS.CREDITS_ONLY);

// Configure for payment failure
const { hooks, services } = configureMocksForScenario(TEST_SCENARIOS.PAYMENT_FAILURE);

// Configure for admin booking
const { hooks, services } = configureMocksForScenario(TEST_SCENARIOS.ADMIN_BOOKING);
```

## Critical Assertions

### Booking Flow Verification
```typescript
// Step verification
expect(bookingService.getAvailability).toHaveBeenCalledWith(startDate, endDate);
expect(bookingService.createPendingPayment).toHaveBeenCalled();
expect(bookingService.createBooking).toHaveBeenCalledWith(expectedPayload);
expect(navigate).toHaveBeenCalledWith('/confirmation', expectedState);
```

### Error Recovery Verification
```typescript
// Admin alert sent
expect(supabase.functions.invoke).toHaveBeenCalledWith('alert-booking-failure', {
  body: expect.objectContaining({
    paymentIntentId: 'pi_test_123',
    userEmail: 'test@example.com',
    systemStatus: {
      confirmationEmailSent: boolean,
      creditsWereDeducted: boolean,
      userWillSeeConfirmationPage: true
    }
  })
});

// Graceful navigation
expect(navigate).toHaveBeenCalledWith('/confirmation', {
  state: {
    booking: expect.objectContaining({
      isPendingManualCreation: true
    })
  }
});
```

### Pricing Calculation Verification
```typescript
// Verify complex pricing breakdown
expect(result.current).toMatchObject({
  totalAccommodationCost: expectedAccommodationCost,
  totalFoodAndFacilitiesCost: expectedFoodCost,
  subtotal: expectedSubtotal,
  appliedCodeDiscountValue: expectedDiscountAmount,
  totalAmount: expectedFinalTotal,
  vatAmount: expectedVAT,
  totalWithVat: expectedTotalWithVAT
});
```

## Test Data Generators

```typescript
import { generateTestCases } from './setup';

// Generate 12-week long stay
const longStayWeeks = generateTestCases.longStay();

// Generate flexible dates scenario
const flexibleWeek = generateTestCases.flexibleDates();

// Generate high-value booking
const highValuePricing = generateTestCases.highValueBooking();
```

## Performance Considerations

The test suite includes performance testing utilities:

```typescript
import { measureRenderTime } from './setup';

const renderTime = await measureRenderTime(() => {
  render(<BookingSummary {...props} />);
});

expect(renderTime).toBeLessThan(100); // 100ms render budget
```

## Known Limitations

1. **Stripe Integration**: Uses mocked StripeCheckoutForm component
2. **Real Database**: No actual database calls (all mocked)
3. **Email Services**: Mocked Supabase function calls
4. **Time Zones**: Uses fixed UTC dates for consistency

## Debugging Tests

### Enable Console Output
```typescript
import { restoreConsole } from './setup';

beforeEach(() => {
  restoreConsole(); // Re-enable console for debugging
});
```

### Inspect Mock Calls
```typescript
console.log('Booking service calls:', bookingService.createBooking.mock.calls);
console.log('Navigation calls:', mockNavigate.mock.calls);
```

### Test Specific Scenarios
```typescript
// Focus on specific test
it.only('should handle payment failure', async () => {
  // Your test here
});
```

## Continuous Integration

These tests are designed to:
- ✅ Run fast (< 30 seconds for full suite)
- ✅ Be deterministic (no flaky tests)
- ✅ Catch regression bugs
- ✅ Validate complex business logic
- ✅ Ensure error recovery works

## Future Enhancements

Consider adding:
- **Visual regression tests** for UI changes
- **Load testing** for high-traffic scenarios  
- **Cross-browser testing** for payment flows
- **Accessibility testing** for booking forms
- **Real Stripe test mode** integration 