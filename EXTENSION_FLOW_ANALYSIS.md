# EXTENSION FLOW COMPLETE ANALYSIS

## Overview
This documents the complete booking extension flow from user click to database updates, including all pricing calculations, triggers, and potential failure points.

## The 6-Step Extension Flow

### STEP 0: User Clicks Extend Button
**Code Location:** `MyBookings.tsx` - Extend button onClick
**Logging Tag:** `[EXTENSION_FLOW] === STEP 0: Extend button clicked ===`

**What Happens:**
- Opens extension modal for selected booking
- Initializes extension state and calendar data
- Sets up original booking dates as reference

**Database Impact:** None
**Potential Failures:** Modal rendering issues

---

### STEP 1: Extension Confirmation
**Code Location:** `MyBookings.tsx` - `handleConfirmExtension()`
**Logging Tag:** `[EXTENSION_FLOW] === STEP 1: Extension confirm button clicked ===`

**What Happens:**
- Validates that extension weeks are selected
- Calculates final pricing with credits applied
- Determines if credits-only or requires Stripe payment

**Database Impact:** None (validation phase)
**Potential Failures:** 
- No weeks selected for extension
- Invalid pricing calculations

---

### STEP 2A: Credits-Only Extension (Skip Stripe)
**Code Location:** `MyBookings.tsx` - `handleConfirmExtension()`
**Logging Tag:** `[EXTENSION_FLOW] === STEP 2A: Credits-only extension, skipping Stripe ===`

**Condition:** `finalAmountAfterCredits < 0.5`

**What Happens:**
- Generates fake payment intent ID for credits-only transaction
- Jumps directly to `handleExtensionPaymentSuccess()` 
- No Stripe modal displayed

---

### STEP 2B: Open Stripe Modal (Paid Extension)
**Code Location:** `MyBookings.tsx` - `handleConfirmExtension()`
**Logging Tag:** `[EXTENSION_FLOW] === STEP 2B: Opening Stripe modal for extension ===`

**What Happens:**
- Opens `StripeCheckoutForm` component for remaining amount
- User completes payment in Stripe
- On success, calls `handleExtensionPaymentSuccess()` with payment intent ID

---

### STEP 3: Extension Payment Success Handler
**Code Location:** `MyBookings.tsx` - `handleExtensionPaymentSuccess()`
**Logging Tag:** `[EXTENSION_FLOW] === STEP 3: Extension payment success handler called ===`

**What Happens:**
- Receives payment intent ID (from Stripe) OR fake ID (credits-only)
- Validates extension data and calculates new check-out date
- Prepares comprehensive extension payload with pricing breakdown

**Database Impact:** None yet (preparation phase)
**Potential Failures:** Missing extension information

---

### STEP 4: Call BookingService.extendBooking()
**Code Location:** `MyBookings.tsx` - `handleExtensionPaymentSuccess()`
**Logging Tag:** `[EXTENSION_FLOW] === STEP 4: Calling BookingService.extendBooking ===`

**What Happens:**
- Calls `BookingService.extendBooking()` with extension payload
- **CRITICAL:** This updates the booking and triggers credit deduction

**Database Operations:**
```sql
-- Update the existing booking
UPDATE bookings SET
  check_out = $new_checkout_date,
  total_price = $new_total_price,
  credits_used = $new_credits_used_total,  -- Triggers credit deduction!
  updated_at = NOW()
WHERE id = $booking_id;

-- Insert extension payment record
INSERT INTO payments (
  booking_id,
  user_id,
  start_date,           -- Extension start date
  end_date,             -- Extension end date  
  amount_paid,          -- Amount paid for extension (after credits)
  breakdown_json,       -- Extension pricing breakdown
  discount_code,
  payment_type,         -- 'extension'
  stripe_payment_id,
  status,               -- 'paid'
  created_at,
  updated_at
) VALUES (...);
```

**AUTOMATIC TRIGGER EXECUTION:**
When `credits_used` is updated to a higher value, this trigger fires:

```sql
-- Trigger: booking_credits_update_trigger  
-- Function: handle_booking_credits_update()

-- Only fires when credits_used increases
-- 1. Calculate additional credits used
v_additional_credits_used := NEW.credits_used - OLD.credits_used;

-- 2. Lock user's profile row
SELECT credits FROM profiles WHERE id = NEW.user_id FOR UPDATE;

-- 3. Validate sufficient credits for extension
IF v_user_credits < v_additional_credits_used THEN
  RAISE EXCEPTION 'Insufficient credits for booking extension...';

-- 4. Deduct additional credits from profile  
UPDATE profiles SET credits = v_user_credits - v_additional_credits_used WHERE id = NEW.user_id;

-- 5. Record the extension credit transaction
INSERT INTO credit_transactions (
  user_id, booking_id, amount, new_balance, transaction_type, notes
) VALUES (
  NEW.user_id, NEW.id, -v_additional_credits_used, v_new_balance, 'booking_payment', 
  'Credits used for booking extension...'
);
```

**Potential Failures:**
- Insufficient credits (trigger throws exception)
- Booking not found
- Invalid new check-out date
- Database constraint violations

---

### STEP 5: Cleanup Extension UI State
**Code Location:** `MyBookings.tsx` - `handleExtensionPaymentSuccess()`
**Logging Tag:** `[EXTENSION_FLOW] === STEP 5: Cleaning up extension UI state ===`

**What Happens:**
- Closes payment modal and extension modal
- Resets extension-related state variables
- Clears selected weeks and discount codes

**Database Impact:** None
**Potential Failures:** UI state management issues

---

### STEP 6: Refresh Data and Complete
**Code Location:** `MyBookings.tsx` - `handleExtensionPaymentSuccess()`
**Logging Tag:** `[EXTENSION_FLOW] === STEP 6: Refreshing bookings and credits data ===`

**What Happens:**
- Calls `loadBookings()` to refresh booking list
- Calls `refreshCredits()` to update credit balance in UI
- Extension process completed successfully

**Database Operations:**
```sql
-- Refresh user's bookings
SELECT b.*, acc.title as accommodation_title, ... 
FROM bookings b
JOIN accommodations acc ON b.accommodation_id = acc.id  
WHERE b.user_id = $user_id
ORDER BY b.created_at DESC;

-- Refresh user's credit balance
SELECT credits FROM profiles WHERE id = $user_id;
```

**Potential Failures:** 
- Data refresh errors
- Network issues

---

## Extension Pricing Calculation Logic

### Complex Pricing Rules
The extension pricing system applies discounts based on the **TOTAL** stay (original + extension), not just the extension period:

1. **Seasonal Discount:** Based on total stay period for rate calculation, but stored for extension period only
2. **Duration Discount:** Based on total weeks for both rate calculation and display
3. **Discount Codes:** Applied to extension amount only
4. **Credits:** Deducted from final extension amount

### Key Pricing Components

```typescript
// Extension pricing breakdown
{
  extensionAccommodationPrice: // Weekly rate * extension weeks
  extensionFoodCost: // Based on food contribution slider
  discountAmount: // Discount code applied to extension
  finalExtensionPrice: // After all discounts, before credits
  finalAmountAfterCredits: // What user actually pays
}
```

### Critical Pricing Features

- **Dorm Accommodation Fix:** Dorms get 0% seasonal discount
- **Credit Integration:** Credits automatically reduce payment amount
- **Precise Calculations:** All amounts rounded to 2 decimal places for Stripe compatibility

---

## Critical Database Triggers

### 1. Extension Credit Deduction Trigger
**Trigger:** `booking_credits_update_trigger`
**Function:** `handle_booking_credits_update()`
**Fires:** `AFTER UPDATE OF credits_used ON bookings`
**Condition:** `NEW.credits_used > OLD.credits_used`

**What It Does:**
1. Calculates additional credits used in extension
2. Locks user's profile row to prevent race conditions
3. Validates user has sufficient credits for extension
4. Deducts additional credits from `profiles.credits`
5. Records transaction in `credit_transactions` with extension notes
6. **THROWS EXCEPTION if insufficient credits** (rolls back entire extension)

### 2. Availability Update Trigger
**Trigger:** `update_availability_on_booking`
**Function:** `handle_booking_availability()`
**Fires:** `AFTER INSERT ON bookings` (not triggered by updates)

**Note:** Extensions update existing bookings, so this trigger doesn't fire. Availability is managed through the check-out date change.

---

## Error Scenarios & Recovery

### Payment Succeeds But Extension Fails
**When:** Step 4 fails after Step 2B succeeds
**Detection:** Extension payment exists but booking wasn't updated
**Recovery Actions:**
1. Check for orphaned extension payments (Query #5)
2. Manually update booking check-out date
3. Process refund if extension cannot be completed

### Insufficient Credits for Extension
**When:** Step 4 trigger validation fails
**Result:** Entire transaction rolls back (booking not extended)
**User Experience:** Error message shown, can retry with fewer credits

### Extension Without Payment Record
**When:** Booking is updated but no extension payment created
**Detection:** Booking updated recently but no corresponding extension payment
**Resolution:** Create manual payment record or investigate data inconsistency

---

## Monitoring Queries

Use the queries in `EXTENSION_FLOW_MONITORING.sql` to track:

1. **Extension Activity:** Query #6 - Run continuously to see real-time activity
2. **Booking Extensions:** Query #1 - Track booking check-out date changes
3. **Extension Payments:** Query #2 - Track extension payment creation
4. **Credit Transactions:** Query #3 - Track extension credit deductions
5. **Comprehensive View:** Query #4 - See complete extension picture
6. **Issue Detection:** Query #5 - Find extension problems
7. **Pricing Verification:** Query #8 - Validate extension calculations

---

## Key Insights

1. **Extensions update existing bookings** rather than creating new ones
2. **Credit deduction happens automatically** via database triggers
3. **Pricing calculations consider total stay** for discount rates
4. **Extension payments are separate records** with `payment_type = 'extension'`
5. **Race conditions prevented** through database row locking
6. **Complete pricing breakdowns stored** for historical accuracy
7. **Credits-only extensions** bypass Stripe entirely

---

## Testing Strategy

1. **Credits-Only Extension:** Use enough credits to cover full extension cost
2. **Mixed Payment Extension:** Use some credits + Stripe payment
3. **Full Payment Extension:** No credits, full Stripe payment
4. **Insufficient Credits:** Try to use more credits than available for extension
5. **Extension Payment Failure:** Use Stripe test cards that fail
6. **Multiple Extensions:** Extend the same booking multiple times
7. **Discount Code Extensions:** Apply discount codes to extensions

---

## Extension vs Booking Flow Differences

| Aspect | New Booking Flow | Extension Flow |
|--------|------------------|----------------|
| **Database Operation** | INSERT new booking | UPDATE existing booking |
| **Payment Records** | Single 'initial' payment | Additional 'extension' payment |
| **Credit Triggers** | `booking_credits_trigger` (INSERT) | `booking_credits_update_trigger` (UPDATE) |
| **Pricing Basis** | Selected weeks only | Total stay (original + extension) |
| **UI Modal** | BookingSummary component | MyBookings extension modal |
| **Navigation** | To confirmation page | Stay in MyBookings |

Filter console logs with `[EXTENSION_FLOW]` and `[EXTENSION_PRICING]` tags and run extension monitoring SQL queries to trace the complete flow! 