import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePricing } from '../BookingSummary.hooks';
import type { Week } from '../../../types/calendar';
import type { Accommodation } from '../../../types';
import type { AppliedDiscount } from '../BookingSummary.types';

// Mock the pricing utilities
vi.mock('../../../utils/pricing', () => ({
  getSeasonalDiscount: vi.fn(),
  getDurationDiscount: vi.fn((weeks: number) => {
    if (weeks >= 8) return 0.25; // 25% for 8+ weeks
    if (weeks >= 4) return 0.18; // 18% for 4+ weeks
    if (weeks >= 2) return 0.08; // 8% for 2+ weeks
    return 0; // No discount for 1 week
  }),
  getSeasonBreakdown: vi.fn()
}));

vi.mock('../../../utils/dates', () => ({
  calculateTotalNights: vi.fn((weeks: Week[]) => weeks.length * 7),
  calculateDurationDiscountWeeks: vi.fn((weeks: Week[]) => Math.floor(weeks.length)),
  calculateTotalDays: vi.fn((weeks: Week[]) => weeks.length * 7 + 1),
  calculateTotalWeeksDecimal: vi.fn((weeks: Week[]) => weeks.length)
}));

vi.mock('../BookingSummary.utils', () => ({
  calculateBaseFoodCost: vi.fn((totalNights: number, displayWeeks: number, foodContribution?: number | null) => ({
    totalBaseFoodCost: (foodContribution ?? 345) * displayWeeks,
    effectiveWeeklyRate: foodContribution ?? 345
  }))
}));

describe('Pricing Calculations', () => {
  const mockAccommodation: Accommodation = {
    id: 'acc-1',
    title: 'Test Cabin',
    description: 'Test cabin description',
    base_price: 200,
    type: 'cabin',
    is_unlimited: false,
    inventory: 4,
    capacity: 2,
    bathrooms: 1,
    has_wifi: true,
    has_electricity: true,
    bed_size: 'double',
    image_url: 'test.jpg',
    is_fungible: false,
    parent_accommodation_id: null,
    inventory_count: 4,
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  };

  const mockTestAccommodation: Accommodation = {
    id: 'acc-test',
    title: 'Test Accommodation',
    description: 'Test accommodation description',
    base_price: 50,
    type: 'test',
    is_unlimited: true,
    inventory: 1,
    capacity: 1,
    bathrooms: 1,
    has_wifi: true,
    has_electricity: true,
    bed_size: 'single',
    image_url: 'test.jpg',
    is_fungible: false,
    parent_accommodation_id: null,
    inventory_count: 1,
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  };

  const createMockWeek = (id: string, name: string): Week => ({
    id,
    name,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-08'),
    status: 'visible',
    selectedFlexDate: undefined,
    flexibleDates: []
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Pricing Calculations', () => {
    it('should calculate correct pricing for 1-week stay', () => {
      const selectedWeeks = [createMockWeek('week-1', 'Week 1')];
      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      expect(result.current).toMatchObject({
        totalNights: 7,
        totalAccommodationCost: 200, // 200 * 1 week
        totalFoodAndFacilitiesCost: 345, // 345 * 1 week
        subtotal: 545, // 200 + 345
        totalAmount: 545,
        weeksStaying: 1,
        baseAccommodationRate: 200,
        durationDiscountPercent: 0, // No discount for 1 week
        appliedCodeDiscountValue: 0
      });
    });

    it('should calculate correct pricing for 2-week stay with duration discount', () => {
      const selectedWeeks = [
        createMockWeek('week-1', 'Week 1'),
        createMockWeek('week-2', 'Week 2')
      ];

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      expect(result.current).toMatchObject({
        totalNights: 14,
        totalAccommodationCost: 400, // 200 * 2 weeks
        weeksStaying: 2,
        durationDiscountPercent: 8, // 8% discount for 2+ weeks
        subtotal: expect.any(Number),
        totalAmount: expect.any(Number)
      });

      // Food cost should be discounted
      expect(result.current.totalFoodAndFacilitiesCost).toBeLessThan(345 * 2);
    });

    it('should calculate correct pricing for 4-week stay with higher duration discount', () => {
      const selectedWeeks = Array.from({ length: 4 }, (_, i) => 
        createMockWeek(`week-${i + 1}`, `Week ${i + 1}`)
      );

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      expect(result.current).toMatchObject({
        totalNights: 28,
        totalAccommodationCost: 800, // 200 * 4 weeks
        weeksStaying: 4,
        durationDiscountPercent: 18, // 18% discount for 4+ weeks
        subtotal: expect.any(Number),
        totalAmount: expect.any(Number)
      });
    });

    it('should calculate correct pricing for 8-week stay with maximum duration discount', () => {
      const selectedWeeks = Array.from({ length: 8 }, (_, i) => 
        createMockWeek(`week-${i + 1}`, `Week ${i + 1}`)
      );

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      expect(result.current).toMatchObject({
        totalNights: 56,
        totalAccommodationCost: 1600, // 200 * 8 weeks
        weeksStaying: 8,
        durationDiscountPercent: 25, // 25% discount for 8+ weeks
        subtotal: expect.any(Number),
        totalAmount: expect.any(Number)
      });
    });
  });

  describe('Discount Code Applications', () => {
    const selectedWeeks = [createMockWeek('week-1', 'Week 1')];

    it('should apply discount code to total amount', () => {
      const appliedDiscount: AppliedDiscount = {
        code: 'SAVE20',
        percentage_discount: 20,
        applies_to: 'total'
      };

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount
        })
      );

      expect(result.current).toMatchObject({
        subtotal: 545,
        appliedCodeDiscountValue: 109, // 20% of 545
        totalAmount: 436 // 545 - 109
      });
    });

    it('should apply discount code to accommodation only', () => {
      const appliedDiscount: AppliedDiscount = {
        code: 'ACC10',
        percentage_discount: 10,
        applies_to: 'accommodation'
      };

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount
        })
      );

      expect(result.current).toMatchObject({
        subtotal: 545,
        appliedCodeDiscountValue: 20, // 10% of 200 (accommodation only)
        totalAmount: 525 // 545 - 20
      });
    });

    it('should apply discount code to food & facilities only', () => {
      const appliedDiscount: AppliedDiscount = {
        code: 'FOOD15',
        percentage_discount: 15,
        applies_to: 'food_facilities'
      };

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount
        })
      );

      expect(result.current).toMatchObject({
        subtotal: 545,
        appliedCodeDiscountValue: 51.75, // 15% of 345 (food & facilities only)
        totalAmount: 493.25 // 545 - 51.75
      });
    });

    it('should handle discount codes with duration discounts correctly', () => {
      const selectedWeeks = [
        createMockWeek('week-1', 'Week 1'),
        createMockWeek('week-2', 'Week 2')
      ];

      const appliedDiscount: AppliedDiscount = {
        code: 'SAVE25',
        percentage_discount: 25,
        applies_to: 'total'
      };

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount
        })
      );

      // Should apply discount code to the subtotal (after duration discount)
      expect(result.current.durationDiscountPercent).toBe(8);
      expect(result.current.appliedCodeDiscountValue).toBeGreaterThan(0);
      expect(result.current.totalAmount).toBeLessThan(result.current.subtotal);
    });
  });

  describe('Food Contribution Adjustments', () => {
    const selectedWeeks = [createMockWeek('week-1', 'Week 1')];

    it('should use custom food contribution when provided', () => {
      const customFoodContribution = 400;

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: customFoodContribution,
          appliedDiscount: null
        })
      );

      expect(result.current).toMatchObject({
        totalAccommodationCost: 200,
        totalFoodAndFacilitiesCost: 400,
        subtotal: 600,
        totalAmount: 600
      });
    });

    it('should use default food contribution when null', () => {
      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: null,
          appliedDiscount: null
        })
      );

      expect(result.current).toMatchObject({
        totalAccommodationCost: 200,
        totalFoodAndFacilitiesCost: 345, // Default rate
        subtotal: 545,
        totalAmount: 545
      });
    });
  });

  describe('Test Accommodation Special Handling', () => {
    const selectedWeeks = [createMockWeek('week-1', 'Week 1')];

    it('should override costs for test accommodation', () => {
      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockTestAccommodation,
          calculatedWeeklyAccommodationPrice: 50,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      expect(result.current).toMatchObject({
        totalAccommodationCost: 50,
        totalFoodAndFacilitiesCost: 0, // Override to 0 for test accommodation
        subtotal: 50,
        totalAmount: 50,
        durationDiscountAmount: 0 // No food discount applicable
      });
    });
  });

  describe('VAT Calculations', () => {
    const selectedWeeks = [createMockWeek('week-1', 'Week 1')];

    it('should calculate 24% VAT correctly', () => {
      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      const expectedVAT = 545 * 0.24; // 24% of total amount
      expect(result.current).toMatchObject({
        totalAmount: 545,
        vatAmount: expectedVAT,
        totalWithVat: 545 + expectedVAT
      });
    });

    it('should calculate VAT on discounted amount', () => {
      const appliedDiscount: AppliedDiscount = {
        code: 'SAVE20',
        percentage_discount: 20,
        applies_to: 'total'
      };

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount
        })
      );

      const discountedAmount = 545 - (545 * 0.2); // 436
      const expectedVAT = discountedAmount * 0.24;
      
      expect(result.current).toMatchObject({
        totalAmount: discountedAmount,
        vatAmount: expectedVAT,
        totalWithVat: discountedAmount + expectedVAT
      });
    });

    it('should recalculate VAT for test accommodation', () => {
      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockTestAccommodation,
          calculatedWeeklyAccommodationPrice: 50,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      const expectedVAT = 50 * 0.24; // 24% of 50 (test accommodation total)
      expect(result.current).toMatchObject({
        totalAmount: 50,
        vatAmount: expectedVAT,
        totalWithVat: 50 + expectedVAT
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty weeks array', () => {
      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks: [],
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      expect(result.current).toMatchObject({
        totalNights: 0,
        totalAccommodationCost: 0,
        totalFoodAndFacilitiesCost: 0,
        subtotal: 0,
        totalAmount: 0,
        weeksStaying: 0
      });
    });

    it('should handle null accommodation', () => {
      const selectedWeeks = [createMockWeek('week-1', 'Week 1')];

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: null,
          calculatedWeeklyAccommodationPrice: 0,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      expect(result.current).toMatchObject({
        totalAccommodationCost: 0,
        baseAccommodationRate: 0
      });
    });

    it('should handle zero weekly accommodation price', () => {
      const selectedWeeks = [createMockWeek('week-1', 'Week 1')];

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 0,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      expect(result.current).toMatchObject({
        totalAccommodationCost: 0,
        totalFoodAndFacilitiesCost: 345,
        subtotal: 345,
        totalAmount: 345
      });
    });

    it('should not allow negative totals after discount', () => {
      const selectedWeeks = [createMockWeek('week-1', 'Week 1')];
      const appliedDiscount: AppliedDiscount = {
        code: 'MASSIVE100',
        percentage_discount: 150, // 150% discount (more than total)
        applies_to: 'total'
      };

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount
        })
      );

      expect(result.current.totalAmount).toBeGreaterThanOrEqual(0);
    });

    it('should handle fractional week calculations', () => {
      // Mock fractional weeks by updating the existing mock
      const { calculateTotalWeeksDecimal } = require('../../../utils/dates');
      vi.mocked(calculateTotalWeeksDecimal).mockReturnValue(1.5); // 1.5 weeks

      const selectedWeeks = [createMockWeek('week-1', 'Partial Week')];

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount: null
        })
      );

      expect(result.current.weeksStaying).toBe(1.5);
      expect(result.current.totalAccommodationCost).toBe(300); // 200 * 1.5
    });
  });

  describe('Rounding and Precision', () => {
    it('should round monetary values to 2 decimal places', () => {
      const selectedWeeks = [createMockWeek('week-1', 'Week 1')];
      const appliedDiscount: AppliedDiscount = {
        code: 'WEIRD33',
        percentage_discount: 33.33333, // Should result in repeating decimal
        applies_to: 'total'
      };

      const { result } = renderHook(() => 
        usePricing({
          selectedWeeks,
          selectedAccommodation: mockAccommodation,
          calculatedWeeklyAccommodationPrice: 200,
          foodContribution: 345,
          appliedDiscount
        })
      );

      // All monetary values should be properly rounded
      expect(Number.isInteger(result.current.totalAccommodationCost * 100)).toBe(true);
      expect(Number.isInteger(result.current.totalFoodAndFacilitiesCost * 100)).toBe(true);
      expect(Number.isInteger(result.current.subtotal * 100)).toBe(true);
      expect(Number.isInteger(result.current.totalAmount * 100)).toBe(true);
      expect(Number.isInteger(result.current.appliedCodeDiscountValue * 100)).toBe(true);
    });
  });
}); 