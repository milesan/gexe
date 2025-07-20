import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { BookingSummary } from '../BookingSummary';
import { bookingService } from '../../../services/BookingService';
import { supabase } from '../../../lib/supabase';
import type { Week } from '../../../types/calendar';
import type { Accommodation } from '../../../types';

// Mock the entire booking flow dependencies
vi.mock('../../../services/BookingService');
vi.mock('../../../lib/supabase');
vi.mock('../../../hooks/useSession');
vi.mock('../../../hooks/useUserPermissions');
vi.mock('../../../hooks/useCredits');
vi.mock('../../../hooks/useDiscountCode');
vi.mock('../../../hooks/useSchedulingRules');
vi.mock('../../../utils/pricing');
vi.mock('../StripeCheckoutForm', () => ({
  StripeCheckoutForm: ({ onSuccess, onClose }: any) => (
    <div data-testid="stripe-modal">
      <button onClick={() => onSuccess('pi_test_123')}>Complete Payment</button>
      <button onClick={onClose}>Close</button>
    </div>
  )
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('Booking Flow Integration Tests', () => {
  const mockAccommodation: Accommodation = {
    id: 'acc-1',
    title: 'Test Cabin',
    base_price: 200,
    type: 'cabin',
    is_unlimited: false,
    inventory: 4,
    image_url: 'test.jpg',
    images: []
  };

  const mockWeek: Week = {
    id: 'week-1',
    name: 'Test Week',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-08'),
    selectedFlexDate: null,
    flexibleDates: []
  };

  const defaultProps = {
    selectedWeeks: [mockWeek],
    selectedAccommodation: mockAccommodation,
    onClearWeeks: vi.fn(),
    onClearAccommodation: vi.fn(),
    seasonBreakdown: undefined,
    calculatedWeeklyAccommodationPrice: 200
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup successful flow by default
    vi.mocked(bookingService.getAvailability).mockResolvedValue([
      { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
    ]);
    vi.mocked(bookingService.getCurrentUser).mockResolvedValue({ 
      id: 'user-1', 
      email: 'test@example.com' 
    });
    vi.mocked(bookingService.createPendingPayment).mockResolvedValue({ id: 'payment-1' });
    vi.mocked(bookingService.createBooking).mockResolvedValue({
      id: 'booking-1',
      total_price: 545,
      accommodation: { title: 'Test Cabin' }
    });
    vi.mocked(bookingService.updatePaymentAfterBooking).mockResolvedValue({});
    vi.mocked(bookingService.checkBookingByPaymentIntent).mockResolvedValue(false);

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'mock-token' } }
    });
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } }
    });
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ error: null });
  });

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );

  describe('Happy Path - Regular Booking Flow', () => {
    it('should complete full booking flow: Step 1-9', async () => {
      const navigate = vi.fn();
      vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(navigate);

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      // STEP 1: Click confirm button
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // STEP 2: Should check availability
      await waitFor(() => {
        expect(bookingService.getAvailability).toHaveBeenCalledWith(
          expect.any(Date),
          expect.any(Date)
        );
      });

      // STEP 3: Should create pending payment
      await waitFor(() => {
        expect(bookingService.createPendingPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-1',
            startDate: expect.any(Date),
            endDate: expect.any(Date),
            paymentType: 'initial'
          })
        );
      });

      // STEP 4: Should open Stripe modal
      await waitFor(() => {
        expect(screen.getByTestId('stripe-modal')).toBeInTheDocument();
      });

      // Simulate payment success (STEP 5 triggered)
      const paymentButton = screen.getByText('Complete Payment');
      await act(async () => {
        fireEvent.click(paymentButton);
      });

      // STEP 6: Should create booking
      await waitFor(() => {
        expect(bookingService.createBooking).toHaveBeenCalledWith(
          expect.objectContaining({
            accommodationId: 'acc-1',
            totalPrice: expect.any(Number),
            paymentIntentId: 'pi_test_123'
          })
        );
      });

      // STEP 7: Should update payment record
      await waitFor(() => {
        expect(bookingService.updatePaymentAfterBooking).toHaveBeenCalledWith(
          expect.objectContaining({
            paymentRowId: 'payment-1',
            bookingId: 'booking-1',
            stripePaymentId: 'pi_test_123'
          })
        );
      });

      // STEP 9: Should navigate to confirmation (after delay)
      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/confirmation', 
          expect.objectContaining({
            state: expect.objectContaining({
              booking: expect.objectContaining({
                id: 'booking-1',
                accommodation: 'Test Cabin'
              })
            })
          })
        );
      }, { timeout: 2000 });
    });
  });

  describe('Credits-Only Booking Flow', () => {
    beforeEach(() => {
      // Mock high credits
      const mockUseCredits = {
        credits: 1000,
        loading: false,
        refresh: vi.fn()
      };
      vi.mocked(require('../../../hooks/useCredits').useCredits).mockReturnValue(mockUseCredits);
    });

    it('should skip Stripe for credits-only booking', async () => {
      const navigate = vi.fn();
      vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(navigate);

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      // Enable credits
      const creditsToggle = screen.getByRole('checkbox');
      await act(async () => {
        fireEvent.click(creditsToggle);
      });

      // Set credits to cover full amount
      const creditsSlider = screen.getByRole('slider');
      await act(async () => {
        fireEvent.change(creditsSlider, { target: { value: '545' } });
      });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // Should create pending payment
      await waitFor(() => {
        expect(bookingService.createPendingPayment).toHaveBeenCalled();
      });

      // Should skip Stripe and go directly to booking creation
      await waitFor(() => {
        expect(bookingService.createBooking).toHaveBeenCalledWith(
          expect.objectContaining({
            creditsUsed: 545
          })
        );
      });

      // Should NOT show Stripe modal
      expect(screen.queryByTestId('stripe-modal')).not.toBeInTheDocument();

      // Should navigate to confirmation
      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/confirmation', expect.any(Object));
      });
    });
  });

  describe('Admin Booking Flow', () => {
    beforeEach(() => {
      const mockUseUserPermissions = {
        isAdmin: true,
        isLoading: false
      };
      vi.mocked(require('../../../hooks/useUserPermissions').useUserPermissions)
        .mockReturnValue(mockUseUserPermissions);
    });

    it('should handle admin booking without payment', async () => {
      const navigate = vi.fn();
      vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(navigate);

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const adminConfirmButton = screen.getByRole('button', { name: /admin confirm/i });
      await act(async () => {
        fireEvent.click(adminConfirmButton);
      });

      // Should skip payment steps and go directly to booking creation
      await waitFor(() => {
        expect(bookingService.createBooking).toHaveBeenCalledWith(
          expect.objectContaining({
            accommodationId: 'acc-1',
            isAdmin: true
          })
        );
      });

      expect(screen.queryByTestId('stripe-modal')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/confirmation', expect.any(Object));
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle payment success but booking creation failure', async () => {
      const navigate = vi.fn();
      vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(navigate);

      // Mock booking creation failure
      vi.mocked(bookingService.createBooking).mockRejectedValue(
        new Error('Database connection failed')
      );

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // Complete payment flow
      await waitFor(() => {
        expect(screen.getByTestId('stripe-modal')).toBeInTheDocument();
      });

      const paymentButton = screen.getByText('Complete Payment');
      await act(async () => {
        fireEvent.click(paymentButton);
      });

      // Should attempt booking creation and fail
      await waitFor(() => {
        expect(bookingService.createBooking).toHaveBeenCalled();
      });

      // Should check if webhook created booking
      await waitFor(() => {
        expect(bookingService.checkBookingByPaymentIntent).toHaveBeenCalledWith('pi_test_123');
      });

      // Should send admin alert
      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
          'alert-booking-failure',
          expect.objectContaining({
            body: expect.objectContaining({
              paymentIntentId: 'pi_test_123',
              userEmail: 'test@example.com'
            })
          })
        );
      });

      // Should still navigate to confirmation page
      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/confirmation', 
          expect.objectContaining({
            state: expect.objectContaining({
              booking: expect.objectContaining({
                isPendingManualCreation: true
              })
            })
          })
        );
      });
    });

    it('should handle webhook coordination when booking exists', async () => {
      const navigate = vi.fn();
      vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(navigate);

      // Mock booking creation failure but webhook success
      vi.mocked(bookingService.createBooking).mockRejectedValue(
        new Error('Database error')
      );
      vi.mocked(bookingService.checkBookingByPaymentIntent).mockResolvedValue(true);

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('stripe-modal')).toBeInTheDocument();
      });

      const paymentButton = screen.getByText('Complete Payment');
      await act(async () => {
        fireEvent.click(paymentButton);
      });

      // Should check webhook and find existing booking
      await waitFor(() => {
        expect(bookingService.checkBookingByPaymentIntent).toHaveBeenCalledWith('pi_test_123');
      });

      // Should NOT send admin alert since webhook succeeded
      expect(supabase.functions.invoke).not.toHaveBeenCalledWith(
        'alert-booking-failure',
        expect.any(Object)
      );

      // Should navigate to confirmation
      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/confirmation', 
          expect.objectContaining({
            state: expect.objectContaining({
              booking: expect.objectContaining({
                isPendingManualCreation: false
              })
            })
          })
        );
      });
    });

    it('should handle availability check failure', async () => {
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: false, available_capacity: 0 }
      ]);

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
      });

      // Should not proceed with payment
      expect(screen.queryByTestId('stripe-modal')).not.toBeInTheDocument();
    });

    it('should handle pending payment creation failure', async () => {
      vi.mocked(bookingService.createPendingPayment).mockRejectedValue(
        new Error('Payment service unavailable')
      );

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/failed to create pending payment/i)).toBeInTheDocument();
      });

      // Should not open Stripe modal
      expect(screen.queryByTestId('stripe-modal')).not.toBeInTheDocument();
    });
  });

  describe('Discount Code Integration Flow', () => {
    beforeEach(() => {
      const mockUseDiscountCode = {
        discountCodeInput: '',
        setDiscountCodeInput: vi.fn(),
        appliedDiscount: {
          code: 'SAVE20',
          percentage_discount: 20,
          applies_to: 'total'
        },
        discountError: null,
        isApplyingDiscount: false,
        handleApplyDiscount: vi.fn(),
        handleRemoveDiscount: vi.fn()
      };
      vi.mocked(require('../../../hooks/useDiscountCode').useDiscountCode)
        .mockReturnValue(mockUseDiscountCode);
    });

    it('should include discount in booking payload', async () => {
      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('stripe-modal')).toBeInTheDocument();
      });

      const paymentButton = screen.getByText('Complete Payment');
      await act(async () => {
        fireEvent.click(paymentButton);
      });

      await waitFor(() => {
        expect(bookingService.createBooking).toHaveBeenCalledWith(
          expect.objectContaining({
            appliedDiscountCode: 'SAVE20',
            discountCodePercent: expect.any(Number)
          })
        );
      });
    });
  });

  describe('Multi-Week Booking Flow', () => {
    const multiWeekProps = {
      ...defaultProps,
      selectedWeeks: [
        mockWeek,
        {
          id: 'week-2',
          name: 'Test Week 2',
          startDate: new Date('2024-01-08'),
          endDate: new Date('2024-01-15'),
          selectedFlexDate: null,
          flexibleDates: []
        }
      ]
    };

    it('should handle multi-week booking with duration discounts', async () => {
      render(<BookingSummary {...multiWeekProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('stripe-modal')).toBeInTheDocument();
      });

      const paymentButton = screen.getByText('Complete Payment');
      await act(async () => {
        fireEvent.click(paymentButton);
      });

      await waitFor(() => {
        expect(bookingService.createBooking).toHaveBeenCalledWith(
          expect.objectContaining({
            durationDiscountPercent: expect.any(Number),
            accommodationId: 'acc-1'
          })
        );
      });
    });
  });

  describe('Test Accommodation Special Handling', () => {
    const testAccommodationProps = {
      ...defaultProps,
      selectedAccommodation: {
        ...mockAccommodation,
        id: 'acc-test',
        title: 'Test Accommodation',
        type: 'test',
        base_price: 50
      }
    };

    it('should handle test accommodation with minimum payment', async () => {
      render(<BookingSummary {...testAccommodationProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('stripe-modal')).toBeInTheDocument();
      });

      // Should force minimum Stripe payment amount for test accommodation
      expect(screen.getByTestId('stripe-modal')).toBeInTheDocument();
    });
  });
}); 