import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { BookingSummary } from '../BookingSummary';
import { bookingService } from '../../../services/BookingService';
import { supabase } from '../../../lib/supabase';
import type { Week } from '../../../types/calendar';
import type { Accommodation } from '../../../types';

// Mock all dependencies
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

describe('Booking Error Handling', () => {
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

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default successful mocks
    vi.mocked(bookingService.getCurrentUser).mockResolvedValue({ 
      id: 'user-1', 
      email: 'test@example.com' 
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'mock-token' } }
    });
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } }
    });
  });

  describe('Network and Service Failures', () => {
    it('should handle network timeout during availability check', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      
      vi.mocked(bookingService.getAvailability).mockRejectedValue(timeoutError);

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/an error occurred/i)).toBeInTheDocument();
      });
    });

    it('should handle Supabase database connection failure', async () => {
      const dbError = new Error('Database connection failed');
      
      vi.mocked(bookingService.createPendingPayment).mockRejectedValue(dbError);
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/failed to create pending payment/i)).toBeInTheDocument();
      });
    });

    it('should handle Stripe service unavailable', async () => {
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);
      vi.mocked(bookingService.createPendingPayment).mockResolvedValue({ id: 'payment-1' });

      // Mock Stripe failure by having the StripeCheckoutForm throw
      vi.mocked(require('../StripeCheckoutForm').StripeCheckoutForm).mockImplementation(() => {
        throw new Error('Stripe service unavailable');
      });

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // Should handle gracefully
      await waitFor(() => {
        expect(screen.getByText(/an error occurred/i)).toBeInTheDocument();
      });
    });
  });

  describe('Payment Success but Booking Creation Failures', () => {
    it('should handle database constraint violation during booking creation', async () => {
      const navigate = vi.fn();
      vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(navigate);

      // Setup successful payment flow
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);
      vi.mocked(bookingService.createPendingPayment).mockResolvedValue({ id: 'payment-1' });
      
      // Mock booking creation failure
      const constraintError = new Error('Unique constraint violation');
      constraintError.name = 'PostgresError';
      vi.mocked(bookingService.createBooking).mockRejectedValue(constraintError);
      
      // Mock webhook check - no existing booking
      vi.mocked(bookingService.checkBookingByPaymentIntent).mockResolvedValue(false);
      
      // Mock email and alert services
      vi.mocked(supabase.functions.invoke).mockResolvedValue({ error: null });

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

      // Should handle graceful recovery
      await waitFor(() => {
        expect(bookingService.checkBookingByPaymentIntent).toHaveBeenCalledWith('pi_test_123');
      });

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
          'alert-booking-failure',
          expect.objectContaining({
            body: expect.objectContaining({
              paymentIntentId: 'pi_test_123',
              userEmail: 'test@example.com',
              error: 'Unique constraint violation'
            })
          })
        );
      });

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

    it('should handle email service failure during confirmation email attempt', async () => {
      const navigate = vi.fn();
      vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(navigate);

      // Setup payment success but booking failure
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);
      vi.mocked(bookingService.createPendingPayment).mockResolvedValue({ id: 'payment-1' });
      vi.mocked(bookingService.createBooking).mockRejectedValue(new Error('DB Error'));
      vi.mocked(bookingService.checkBookingByPaymentIntent).mockResolvedValue(false);
      
      // Mock email service failure
      vi.mocked(supabase.functions.invoke).mockImplementation((functionName) => {
        if (functionName === 'send-booking-confirmation') {
          return Promise.resolve({ error: new Error('Email service down') });
        }
        return Promise.resolve({ error: null });
      });

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

      // Should still send alert with email failure status
      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
          'alert-booking-failure',
          expect.objectContaining({
            body: expect.objectContaining({
              systemStatus: expect.objectContaining({
                confirmationEmailSent: false
              })
            })
          })
        );
      });

      // Should still navigate to confirmation
      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/confirmation', expect.any(Object));
      });
    });

    it('should handle credits deduction failure after payment success', async () => {
      const navigate = vi.fn();
      vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(navigate);

      // Mock high credits
      const mockUseCredits = {
        credits: 100,
        loading: false,
        refresh: vi.fn()
      };
      vi.mocked(require('../../../hooks/useCredits').useCredits).mockReturnValue(mockUseCredits);

      // Setup payment success but booking failure
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);
      vi.mocked(bookingService.createPendingPayment).mockResolvedValue({ id: 'payment-1' });
      vi.mocked(bookingService.createBooking).mockRejectedValue(new Error('DB Error'));
      vi.mocked(bookingService.checkBookingByPaymentIntent).mockResolvedValue(false);
      
      // Mock credit deduction failure
      vi.mocked(supabase.rpc).mockRejectedValue(new Error('Credit service unavailable'));
      vi.mocked(supabase.functions.invoke).mockResolvedValue({ error: null });

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      // Enable credits
      const creditsToggle = screen.getByRole('checkbox');
      await act(async () => {
        fireEvent.click(creditsToggle);
      });

      const creditsSlider = screen.getByRole('slider');
      await act(async () => {
        fireEvent.change(creditsSlider, { target: { value: '50' } });
      });

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

      // Should report credit deduction failure
      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
          'alert-booking-failure',
          expect.objectContaining({
            body: expect.objectContaining({
              systemStatus: expect.objectContaining({
                creditsWereDeducted: false
              })
            })
          })
        );
      });
    });
  });

  describe('Webhook Coordination Failures', () => {
    it('should handle webhook check service failure', async () => {
      const navigate = vi.fn();
      vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(navigate);

      // Setup booking creation failure
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);
      vi.mocked(bookingService.createPendingPayment).mockResolvedValue({ id: 'payment-1' });
      vi.mocked(bookingService.createBooking).mockRejectedValue(new Error('DB Error'));
      
      // Mock webhook check failure
      vi.mocked(bookingService.checkBookingByPaymentIntent).mockRejectedValue(
        new Error('Webhook service unavailable')
      );
      vi.mocked(supabase.functions.invoke).mockResolvedValue({ error: null });

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

      // Should continue with alert even if webhook check fails
      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
          'alert-booking-failure',
          expect.any(Object)
        );
      });

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/confirmation', expect.any(Object));
      });
    });

    it('should handle alert service failure with fallback bug report', async () => {
      const navigate = vi.fn();
      vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(navigate);

      // Setup booking failure
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);
      vi.mocked(bookingService.createPendingPayment).mockResolvedValue({ id: 'payment-1' });
      vi.mocked(bookingService.createBooking).mockRejectedValue(new Error('DB Error'));
      vi.mocked(bookingService.checkBookingByPaymentIntent).mockResolvedValue(false);
      
      // Mock alert service failure but bug report success
      vi.mocked(supabase.functions.invoke).mockImplementation((functionName) => {
        if (functionName === 'alert-booking-failure') {
          return Promise.reject(new Error('Alert service down'));
        }
        if (functionName === 'submit-bug-report') {
          return Promise.resolve({ error: null });
        }
        return Promise.resolve({ error: null });
      });

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

      // Should fall back to bug report
      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
          'submit-bug-report',
          expect.objectContaining({
            body: expect.objectContaining({
              description: expect.stringContaining('CRITICAL: Payment received but booking creation failed')
            })
          })
        );
      });
    });
  });

  describe('Authentication and Authorization Failures', () => {
    it('should handle session expiry during booking flow', async () => {
      // Mock session expiry
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null }
      });

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/authentication required/i)).toBeInTheDocument();
      });
    });

    it('should handle user not found during booking creation', async () => {
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);
      vi.mocked(bookingService.createPendingPayment).mockResolvedValue({ id: 'payment-1' });
      vi.mocked(bookingService.getCurrentUser).mockResolvedValue(null);

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

      // Should handle user not found gracefully
      await waitFor(() => {
        expect(screen.getByText(/missing required booking information/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Validation Failures', () => {
    it('should handle invalid accommodation data', async () => {
      const invalidAccommodation = {
        ...mockAccommodation,
        id: '', // Invalid ID
        base_price: -100 // Invalid price
      };

      render(
        <BookingSummary 
          {...defaultProps} 
          selectedAccommodation={invalidAccommodation}
        />, 
        { wrapper: TestWrapper }
      );

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // Should handle validation failure
      await waitFor(() => {
        expect(screen.getByText(/an error occurred/i)).toBeInTheDocument();
      });
    });

    it('should handle corrupted week date data', async () => {
      const corruptedWeek = {
        ...mockWeek,
        startDate: new Date('invalid-date'),
        endDate: new Date('invalid-date')
      };

      render(
        <BookingSummary 
          {...defaultProps} 
          selectedWeeks={[corruptedWeek]}
        />, 
        { wrapper: TestWrapper }
      );

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // Should handle invalid dates gracefully
      await waitFor(() => {
        expect(screen.getByText(/select a valid check-in date/i)).toBeInTheDocument();
      });
    });
  });

  describe('Concurrency and Race Condition Handling', () => {
    it('should handle accommodation becoming unavailable during booking process', async () => {
      // Start with available accommodation
      vi.mocked(bookingService.getAvailability).mockResolvedValueOnce([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);

      // Then return unavailable on subsequent checks
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
    });

    it('should handle multiple rapid booking attempts', async () => {
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);
      vi.mocked(bookingService.createPendingPayment).mockResolvedValue({ id: 'payment-1' });

      render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      
      // Rapid fire clicks
      await act(async () => {
        fireEvent.click(confirmButton);
        fireEvent.click(confirmButton);
        fireEvent.click(confirmButton);
      });

      // Should only process one booking attempt
      await waitFor(() => {
        expect(bookingService.createPendingPayment).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Component Unmounting During Async Operations', () => {
    it('should handle component unmount during booking creation', async () => {
      // Mock slow booking creation
      vi.mocked(bookingService.getAvailability).mockResolvedValue([
        { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
      ]);
      vi.mocked(bookingService.createPendingPayment).mockResolvedValue({ id: 'payment-1' });
      vi.mocked(bookingService.createBooking).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      );

      const { unmount } = render(<BookingSummary {...defaultProps} />, { wrapper: TestWrapper });

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

      // Unmount component during booking creation
      unmount();

      // Should not cause memory leaks or unhandled promise rejections
      // This is primarily tested by watching for console errors
    });
  });
}); 