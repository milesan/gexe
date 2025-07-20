import { vi, expect } from 'vitest';
import '@testing-library/jest-dom';

// Global test setup for BookingSummary tests

// Mock environment variables
vi.stubGlobal('import.meta', {
  env: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_STRIPE_PUBLIC_KEY: 'pk_test_123',
    MODE: 'test'
  }
});

// Mock window.location for navigation tests
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000/book',
    pathname: '/book'
  },
  writable: true
});

// Mock crypto for payment ID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123'
  }
});

// Mock console methods to avoid test noise
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Suppress console output during tests unless specifically testing console behavior
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Restore console for debugging when needed
export const restoreConsole = () => {
  global.console = {
    ...console,
    log: originalConsoleLog,
    warn: originalConsoleWarn,
    error: originalConsoleError
  };
};

// Helper to create mock session data
export const createMockSession = (overrides: any = {}) => ({
  session: {
    user: { 
      id: 'user-1', 
      email: 'test@example.com',
      ...(overrides.user || {})
    },
    access_token: 'mock-token',
    ...(overrides.session || {})
  },
  ...overrides
});

// Helper to create mock accommodation data
export const createMockAccommodation = (overrides = {}) => ({
  id: 'acc-1',
  title: 'Test Cabin',
  base_price: 200,
  type: 'cabin',
  is_unlimited: false,
  inventory: 4,
  image_url: 'test.jpg',
  images: [],
  ...overrides
});

// Helper to create mock week data
export const createMockWeek = (overrides = {}) => ({
  id: 'week-1',
  name: 'Test Week',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-08'),
  selectedFlexDate: null,
  flexibleDates: [],
  ...overrides
});

// Helper to create mock pricing data
export const createMockPricing = (overrides = {}) => ({
  totalNights: 7,
  totalAccommodationCost: 200,
  totalFoodAndFacilitiesCost: 345,
  subtotal: 545,
  totalAmount: 545,
  appliedCodeDiscountValue: 0,
  weeksStaying: 1,
  effectiveBaseRate: 345,
  nightlyAccommodationRate: 28.57,
  baseAccommodationRate: 200,
  durationDiscountAmount: 0,
  durationDiscountPercent: 0,
  seasonalDiscount: 0,
  vatAmount: 130.8,
  totalWithVat: 675.8,
  ...overrides
});

// Helper to create mock discount data
export const createMockDiscount = (overrides = {}) => ({
  code: 'SAVE20',
  percentage_discount: 20,
  applies_to: 'total',
  ...overrides
});

// Mock hook return values factory
export const createMockHooks = () => ({
  useSession: createMockSession(),
  useCredits: {
    credits: 50,
    loading: false,
    refresh: vi.fn()
  },
  useDiscountCode: {
    discountCodeInput: '',
    setDiscountCodeInput: vi.fn(),
    appliedDiscount: null,
    discountError: null,
    isApplyingDiscount: false,
    handleApplyDiscount: vi.fn(),
    handleRemoveDiscount: vi.fn()
  },
  useUserPermissions: {
    isAdmin: false,
    isLoading: false
  },
  useSchedulingRules: {
    getArrivalDepartureForDate: vi.fn().mockReturnValue({
      arrival: new Date('2024-01-01'),
      departure: new Date('2024-01-08')
    })
  },
  usePricing: createMockPricing()
});

// Mock service responses factory
export const createMockServices = () => ({
  bookingService: {
    createBooking: vi.fn().mockResolvedValue({
      id: 'booking-1',
      total_price: 545,
      accommodation: { title: 'Test Cabin' }
    }),
    updatePaymentAfterBooking: vi.fn().mockResolvedValue({}),
    createPendingPayment: vi.fn().mockResolvedValue({ id: 'payment-1' }),
    getAvailability: vi.fn().mockResolvedValue([
      { accommodation_id: 'acc-1', is_available: true, available_capacity: 4 }
    ]),
    getCurrentUser: vi.fn().mockResolvedValue({ 
      id: 'user-1', 
      email: 'test@example.com' 
    }),
    checkBookingByPaymentIntent: vi.fn().mockResolvedValue(false)
  },
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } }
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' } }
      })
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null })
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  }
});

// Test scenario configurations
export const TEST_SCENARIOS = {
  HAPPY_PATH: 'happy_path',
  CREDITS_ONLY: 'credits_only',
  ADMIN_BOOKING: 'admin_booking',
  PAYMENT_FAILURE: 'payment_failure',
  BOOKING_FAILURE: 'booking_failure',
  WEBHOOK_COORDINATION: 'webhook_coordination',
  AVAILABILITY_FAILURE: 'availability_failure',
  NETWORK_FAILURE: 'network_failure'
};

// Configure mocks for specific test scenarios
export const configureMocksForScenario = (scenario: string, customOverrides = {}) => {
  const baseHooks = createMockHooks();
  const baseServices = createMockServices();
  
  switch (scenario) {
    case TEST_SCENARIOS.CREDITS_ONLY:
      return {
        hooks: {
          ...baseHooks,
          useCredits: {
            ...baseHooks.useCredits,
            credits: 1000 // More than total amount
          }
        },
        services: baseServices
      };
      
    case TEST_SCENARIOS.ADMIN_BOOKING:
      return {
        hooks: {
          ...baseHooks,
          useUserPermissions: {
            ...baseHooks.useUserPermissions,
            isAdmin: true
          }
        },
        services: baseServices
      };
      
    case TEST_SCENARIOS.PAYMENT_FAILURE:
      return {
        hooks: baseHooks,
        services: {
          ...baseServices,
          bookingService: {
            ...baseServices.bookingService,
            createBooking: vi.fn().mockRejectedValue(new Error('Database error'))
          }
        }
      };
      
    case TEST_SCENARIOS.AVAILABILITY_FAILURE:
      return {
        hooks: baseHooks,
        services: {
          ...baseServices,
          bookingService: {
            ...baseServices.bookingService,
            getAvailability: vi.fn().mockResolvedValue([
              { accommodation_id: 'acc-1', is_available: false, available_capacity: 0 }
            ])
          }
        }
      };
      
    case TEST_SCENARIOS.NETWORK_FAILURE:
      const networkError = new Error('Network timeout');
      networkError.name = 'NetworkError';
      return {
        hooks: baseHooks,
        services: {
          ...baseServices,
          bookingService: {
            ...baseServices.bookingService,
            getAvailability: vi.fn().mockRejectedValue(networkError)
          }
        }
      };
      
    case TEST_SCENARIOS.HAPPY_PATH:
    default:
      return {
        hooks: baseHooks,
        services: baseServices
      };
  }
};

// Utility to wait for async state updates
export const waitForAsyncUpdate = () => new Promise(resolve => setTimeout(resolve, 0));

// Utility to advance timers in tests
export const advanceTimers = (ms: number) => {
  vi.advanceTimersByTime(ms);
  return waitForAsyncUpdate();
};

// Test data generators for edge cases
export const generateTestCases = {
  longStay: () => Array.from({ length: 12 }, (_, i) => 
    createMockWeek({ 
      id: `week-${i + 1}`, 
      name: `Week ${i + 1}`,
      startDate: new Date(`2024-01-${(i * 7) + 1}`),
      endDate: new Date(`2024-01-${(i + 1) * 7}`)
    })
  ),
  
  flexibleDates: () => createMockWeek({
    flexibleDates: [
      new Date('2024-01-01'),
      new Date('2024-01-02'),
      new Date('2024-01-03')
    ],
    selectedFlexDate: new Date('2024-01-02')
  }),
  
  highValueBooking: () => createMockPricing({
    totalAccommodationCost: 5000,
    totalFoodAndFacilitiesCost: 2000,
    subtotal: 7000,
    totalAmount: 7000
  }),
  
  fractionalWeeks: () => ({
    weeksStaying: 2.5,
    totalNights: 17
  })
};

// Assertion helpers
export const expectBookingPayload = (mockCreateBooking: any, expectedFields: object) => {
  expect(mockCreateBooking).toHaveBeenCalledWith(
    expect.objectContaining(expectedFields)
  );
};

export const expectErrorState = (container: HTMLElement, expectedMessage?: string) => {
  const errorElement = container.querySelector('[role="alert"], .error, [class*="error"]');
  expect(errorElement).toBeInTheDocument();
  if (expectedMessage) {
    expect(errorElement).toHaveTextContent(expectedMessage);
  }
};

export const expectNavigationToConfirmation = (mockNavigate: any, bookingOverrides = {}) => {
  expect(mockNavigate).toHaveBeenCalledWith('/confirmation', 
    expect.objectContaining({
      state: expect.objectContaining({
        booking: expect.objectContaining(bookingOverrides)
      })
    })
  );
};

// Performance testing utilities
export const measureRenderTime = async (renderFunction: () => void) => {
  const start = performance.now();
  renderFunction();
  await waitForAsyncUpdate();
  const end = performance.now();
  return end - start;
};

// Mock cleanup utility
export const cleanupMocks = () => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.resetModules();
}; 