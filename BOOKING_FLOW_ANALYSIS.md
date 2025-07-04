# BOOKING FLOW COMPLETE ANALYSIS

## Overview
This documents the complete booking flow from user click to database updates, including all triggers and potential failure points.

## The 9-Step Booking Flow

### STEP 1: User Clicks Confirm
**Code Location:** `BookingSummary.tsx` - `handleConfirmClick()`
**Logging Tag:** `[BOOKING_FLOW] === STEP 1: Confirm button clicked ===`

**What Happens:**
- Validates check-in date selection
- Clears any previous errors
- Proceeds to availability validation

**Database Impact:** None
**Potential Failures:** Invalid check-in date

---

### STEP 2: Availability Validation  
**Code Location:** `BookingSummary.tsx` - `validateAvailability()`
**Logging Tag:** `[BOOKING_FLOW] === STEP 2: Validating availability ===`

**What Happens:**
- Calls `bookingService.getAvailability()` 
- Uses RPC `get_accommodation_availability()`
- Checks if selected accommodation is still available

**Database Operations:**
```sql
-- Calls this RPC function
SELECT * FROM get_accommodation_availability(check_in_date, check_out_date);
```

**Potential Failures:** 
- Accommodation no longer available
- Database connection issues

---

### STEP 3: Create Pending Payment Row
**Code Location:** `BookingSummary.tsx` - `handleConfirmClick()`
**Logging Tag:** `[BOOKING_FLOW] === STEP 3: Creating pending payment row ===`

**What Happens:**
- Calls `bookingService.createPendingPayment()`
- Creates payment record with `status = 'pending'`
- `booking_id = NULL` initially
- Stores complete price breakdown in `breakdown_json`

**Database Operations:**
```sql
INSERT INTO payments (
  booking_id,          -- NULL initially
  user_id,
  start_date,
  end_date, 
  amount_paid,         -- Final amount after credits
  breakdown_json,      -- Complete price breakdown
  discount_code,
  payment_type,        -- 'initial'
  status,              -- 'pending'
  created_at,
  updated_at
) VALUES (...);
```

**Potential Failures:**
- Database insertion errors
- Invalid breakdown JSON
- User authentication issues

---

### STEP 4A: Credits-Only Booking (Skip Stripe)
**Code Location:** `BookingSummary.tsx` - `handleConfirmClick()`
**Logging Tag:** `[BOOKING_FLOW] === STEP 4: Credits-only booking, skipping Stripe ===`

**Condition:** `finalAmountAfterCredits === 0 && creditsToUse > 0`

**What Happens:**
- Skips Stripe payment entirely
- Jumps directly to `handleBookingSuccess()` with payment row ID
- No Stripe payment intent created

---

### STEP 4B: Open Stripe Modal (Paid Booking)
**Code Location:** `BookingSummary.tsx` - `handleConfirmClick()`
**Logging Tag:** `[BOOKING_FLOW] === STEP 4: Opening Stripe modal ===`

**What Happens:**
- Opens `StripeCheckoutForm` component
- User completes payment in Stripe
- On success, calls `handleBookingSuccess()` with payment intent ID

---

### STEP 5: Booking Success Handler
**Code Location:** `BookingSummary.tsx` - `handleBookingSuccess()`
**Logging Tag:** `[BOOKING_FLOW] === STEP 5: handleBookingSuccess called ===`

**What Happens:**
- Receives payment intent ID (from Stripe) OR payment row ID (credits-only)
- Validates all required booking information
- Calculates final dates and pricing breakdown
- Prepares comprehensive booking payload

**Database Impact:** None yet (preparation phase)
**Potential Failures:** Missing required information

---

### STEP 6: Create Booking in Database
**Code Location:** `BookingService.ts` - `createBooking()`
**Logging Tag:** `[BOOKING_FLOW] === STEP 6: Creating booking in database ===`

**What Happens:**
- Inserts booking record with complete price breakdown
- **CRITICAL:** This triggers the credit deduction automatically

**Database Operations:**
```sql
-- Main booking insertion
INSERT INTO bookings (
  accommodation_id,
  user_id,
  check_in,
  check_out,
  total_price,
  status,                           -- 'confirmed'
  payment_intent_id,
  applied_discount_code,
  credits_used,                     -- Triggers credit deduction!
  accommodation_price,
  food_contribution,
  seasonal_adjustment,
  seasonal_discount_percent,
  duration_discount_percent,
  discount_amount,
  accommodation_price_paid,
  accommodation_price_after_seasonal_duration,
  subtotal_after_discount_code,
  -- ... other pricing fields
  created_at,
  updated_at
) VALUES (...);
```

**AUTOMATIC TRIGGER EXECUTION:**
When `credits_used > 0`, this trigger fires immediately:

```sql
-- Trigger: booking_credits_trigger
-- Function: handle_booking_with_credits()

-- 1. Lock user's profile row
SELECT credits FROM profiles WHERE id = NEW.user_id FOR UPDATE;

-- 2. Validate sufficient credits  
IF v_user_credits < NEW.credits_used THEN
  RAISE EXCEPTION 'Insufficient credits...';

-- 3. Deduct credits from profile
UPDATE profiles SET credits = v_user_credits - NEW.credits_used WHERE id = NEW.user_id;

-- 4. Record transaction
INSERT INTO credit_transactions (
  user_id, booking_id, amount, new_balance, transaction_type, notes
) VALUES (
  NEW.user_id, NEW.id, -NEW.credits_used, v_new_balance, 'booking_payment', '...'
);
```

**Potential Failures:**
- Insufficient credits (trigger throws exception)
- Database constraint violations
- Accommodation no longer available
- Date format issues

---

### STEP 7: Update Payment Record
**Code Location:** `BookingService.ts` - `updatePaymentAfterBooking()`
**Logging Tag:** `[BOOKING_FLOW] === STEP 7: Updating payment record ===`

**What Happens:**
- Links payment record to booking ID
- Updates payment status to 'paid'
- Sets Stripe payment ID (or credits-only ID)

**Database Operations:**
```sql
UPDATE payments SET
  booking_id = $booking_id,        -- Link to booking
  status = 'paid',                 -- Mark as paid
  stripe_payment_id = $payment_id, -- Stripe ID or 'credits-only-{booking_id}'
  updated_at = NOW()
WHERE id = $payment_row_id;
```

**Potential Failures:**
- Payment row not found
- Booking ID mismatch

---

### STEP 8: Refresh Credits (UI Update)
**Code Location:** `BookingSummary.tsx` - `handleBookingSuccess()`
**Logging Tag:** `[BOOKING_FLOW] === STEP 8: Refreshing credits after use ===`

**What Happens:**
- Calls `refreshCredits()` to update UI
- Ensures user sees updated credit balance immediately
- Has fallback refresh after 1 second

**Database Operations:**
```sql
-- useCredits hook queries user's current balance
SELECT credits FROM profiles WHERE id = $user_id;
```

**Note:** Credits were already deducted by the trigger in Step 6, this just updates the UI.

---

### STEP 9: Navigate to Confirmation
**Code Location:** `BookingSummary.tsx` - `handleBookingSuccess()`
**Logging Tag:** `[BOOKING_FLOW] === STEP 9: Navigating to confirmation ===`

**What Happens:**
- Shows celebration fireflies animation
- Navigates to confirmation page with booking details
- Clears selected weeks and accommodation

**Database Impact:** None
**Potential Failures:** Navigation errors (rare)

---

## Critical Database Triggers

### 1. Credit Deduction Trigger
**Trigger:** `booking_credits_trigger`
**Function:** `handle_booking_with_credits()`
**Fires:** `AFTER INSERT ON bookings`
**Condition:** `NEW.credits_used > 0`

**What It Does:**
1. Locks user's profile row to prevent race conditions
2. Validates user has sufficient credits
3. Deducts credits from `profiles.credits`
4. Records transaction in `credit_transactions`
5. **THROWS EXCEPTION if insufficient credits** (rolls back entire booking)

### 2. Booking Extension Credit Trigger  
**Trigger:** `booking_credits_update_trigger`
**Function:** `handle_booking_credits_update()`
**Fires:** `AFTER UPDATE OF credits_used ON bookings`
**Condition:** `NEW.credits_used > OLD.credits_used`

**Purpose:** Handles credit deduction when extending bookings

### 3. Availability Update Trigger
**Trigger:** `update_availability_on_booking`
**Function:** `handle_booking_availability()`
**Fires:** `AFTER INSERT ON bookings`

**What It Does:**
1. Marks all dates in booking range as 'BOOKED' in availability table
2. Prevents double-booking of accommodations

### 4. Whitelist Tracking Trigger
**Trigger:** `update_whitelist_on_booking`  
**Function:** `update_whitelist_tracking()`
**Fires:** `AFTER INSERT ON bookings`

**What It Does:**
1. Updates whitelist entry with booking statistics
2. Tracks first/last booking dates and total count

---

## Error Scenarios & Recovery

### Payment Succeeds But Booking Fails
**When:** Step 6 fails after Step 4B succeeds
**Detection:** Payment intent exists but no booking found
**Recovery Actions:**
1. Send admin alert email with payment details
2. Attempt to send confirmation email to user anyway  
3. Try to manually deduct credits if they were involved
4. Navigate user to confirmation page with pending status
5. Admin must manually create booking or process refund

### Insufficient Credits
**When:** Step 6 trigger validation fails
**Result:** Entire transaction rolls back (booking not created)
**User Experience:** Error message shown, can retry with fewer credits

### Database Connection Issues
**When:** Any database operation fails
**Result:** User sees error, can retry
**Data Consistency:** Transactions ensure no partial states

---

## Monitoring Queries

Use the queries in `BOOKING_FLOW_MONITORING.sql` to track:

1. **Active Monitoring:** Query #7 - Run continuously to see real-time activity
2. **Pending Payments:** Query #1 - Track Step 3 payment creation  
3. **Booking Creation:** Query #2 - Track Step 6 booking insertion
4. **Payment Updates:** Query #3 - Track Step 7 payment linking
5. **Credit Transactions:** Query #4 - Track trigger-based credit deductions
6. **Comprehensive View:** Query #5 - See complete booking + payment picture
7. **Error Detection:** Query #6 - Find orphaned payments

## Key Insights

1. **Credits are deducted by database triggers**, not application code
2. **Pending payments are created BEFORE Stripe** to handle credits-only bookings
3. **The system gracefully handles payment-without-booking scenarios**
4. **Multiple triggers fire during booking creation** (credits, availability, whitelist)
5. **Race conditions are prevented** through database row locking
6. **Complete price breakdowns are stored** for historical accuracy

## Testing Strategy

1. **Credits-Only Booking:** Set total after credits to 0
2. **Mixed Payment:** Use some credits + Stripe payment
3. **Full Payment:** No credits, full Stripe payment  
4. **Insufficient Credits:** Try to use more credits than available
5. **Payment Failure:** Use Stripe test cards that fail
6. **Database Failure:** Monitor behavior during simulated DB issues

Filter console logs with `[BOOKING_FLOW]` and run monitoring SQL queries to trace the complete flow! 