# Voice-Enabled Application Flow Requirements

## Overview
Transform the application process to be voice-first with text fallback, including date/accommodation selection and a streamlined post-approval booking flow.

## User Stories

### 1. Voice-First Application Process
**As a user**, I want to interact with an AI voice by default to make the application process more convenient.
- Integration: Hume AI for voice interaction
- Entry point: `src/pages/Retro2Page.tsx`
- Voice handles all existing application questions

### 2. Text Input Fallback
**As a user**, I want the option to switch to text input if I don't like or can't use voice.
- Toggle button: "Does this freak you out? Click here to switch to text"
- Seamless transition preserving all entered data
- Current text-based form remains as fallback

### 3. Date & Accommodation Selection in Application
**As a user**, I want to select dates and accommodation during the application process to clearly indicate what I'm looking for.
- Integrate date picker and accommodation selector into application flow
- Store selections as part of application data
- Questions added to application flow:
  - Desired check-in date
  - Desired check-out date  
  - Preferred accommodation type

### 4. Admin Application Review
**As an admin**, I want to see the user's requested dates and accommodation in the admin panel.
- Display in `src/components/admin/Applications2.tsx`
- Show requested dates prominently
- Show preferred accommodation
- Existing approve/reject functionality remains

### 5. 72-Hour Reservation System
**System-level**, after approval, the requested dates and accommodation should be reserved for 72 hours.
- Create pending booking record on approval
- Only the approved user can claim this reservation
- Auto-expire after 72 hours if not claimed
- Handle conflicts if dates/accommodation unavailable

### 6. Approval Email with Reservation
**As a user**, I want to receive an approval email telling me my dates/accommodation are reserved.
- Email variations:
  - "We've reserved your requested dates and accommodation - come claim them!"
  - "Your requested dates are unavailable, but you're approved - come select alternatives!"
- Include 72-hour expiration notice
- Direct link to simplified booking page

### 7. Simplified Booking Experience
**As an approved user**, I want a simplified booking page showing my reserved dates/accommodation.
- Modified version of `src/pages/Book2Page.tsx`
- Pre-selected dates and accommodation
- Small buttons to "Request different dates" or "Request different accommodation"
- Loading state while changes process
- Update pending booking when selections change

### 8. Payment Integration
**As a user**, I want to complete payment for my booking.
- Existing Stripe integration
- After payment, grant full site access
- Convert pending booking to confirmed

## Technical Architecture

### Database Schema Changes

#### New Tables
```sql
-- Pending bookings for approved applications
CREATE TABLE pending_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id),
  accommodation_id UUID REFERENCES weekly_accommodations(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Application Data Structure
Add to existing application data JSON:
```json
{
  "requested_dates": {
    "check_in": "2024-06-01",
    "check_out": "2024-06-15"
  },
  "requested_accommodation": "accommodation_uuid"
}
```

### Voice Integration Architecture

#### Hume AI Integration
- SDK: `@humeai/voice` or API integration
- Voice session management
- Real-time transcription
- Question flow state machine
- Seamless handoff to text mode

#### Components Structure
```
src/
  components/
    voice/
      VoiceInterface.tsx       # Main voice UI component
      VoiceToggle.tsx          # Switch between voice/text
      VoiceSession.tsx         # Hume session management
    application/
      DateAccommodationPicker.tsx  # Date & accommodation selection
      SimplifiedBookingFlow.tsx     # Post-approval booking
```

### State Management

#### Application Flow States
1. `voice_active` - Voice interface active
2. `text_mode` - Text form active
3. `selecting_dates` - Date picker open
4. `selecting_accommodation` - Accommodation picker open
5. `reviewing` - Final review before submission

#### Booking Flow States
1. `loading` - Fetching reservation
2. `reserved` - Showing reserved dates/accommodation
3. `modifying` - Changing selection
4. `payment` - Payment process
5. `complete` - Booking confirmed

### API Endpoints

#### New Endpoints Needed
- `POST /api/pending-bookings` - Create reservation on approval
- `GET /api/pending-bookings/:userId` - Get user's reservation
- `PUT /api/pending-bookings/:id` - Update reservation
- `POST /api/claim-booking` - Convert to real booking after payment

### Email Templates

#### Approval with Reservation
Subject: "Welcome! Your dates are reserved for 72 hours"
- Personalized greeting
- Reserved dates and accommodation details
- 72-hour expiration warning
- CTA button to complete booking

#### Approval without Availability
Subject: "Welcome! Please select your dates"
- Personalized greeting
- Note about unavailability
- 72-hour window to book
- CTA button to select alternatives

## Implementation Phases

### Phase 1: Core Infrastructure
1. Database schema updates
2. Basic voice integration setup
3. Date/accommodation picker components

### Phase 2: Application Flow
1. Integrate pickers into Retro2Page
2. Update admin panel display
3. Voice interface implementation

### Phase 3: Reservation System
1. Pending bookings table and logic
2. Approval flow modifications
3. Email templates

### Phase 4: Simplified Booking
1. Simplified Book2Page variant
2. Reservation management
3. Payment integration

### Phase 5: Testing & Polish
1. End-to-end testing
2. Voice experience optimization
3. Error handling and edge cases

## Security Considerations
- Validate all date/accommodation selections
- Prevent double-booking race conditions
- Secure pending booking claims (user auth required)
- Rate limiting on modification requests

## Performance Considerations
- Lazy load voice SDK only when needed
- Cache accommodation availability
- Optimize date picker for mobile
- Minimize re-renders in booking flow

## Accessibility
- Full keyboard navigation
- Screen reader support for voice toggle
- Clear visual indicators for voice state
- Fallback for users without microphone

## Success Metrics
- Application completion rate
- Voice vs text usage ratio
- Time to complete application
- Reservation claim rate
- Payment conversion rate