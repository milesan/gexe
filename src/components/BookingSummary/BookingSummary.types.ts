import type { Week } from '../../types/calendar';
import type { Accommodation } from '../../types';

// Define the season breakdown type
export interface SeasonBreakdown {
  hasMultipleSeasons: boolean;
  seasons: Array<{
    name: string;
    discount: number;
    nights: number;
  }>;
}

export interface BookingSummaryProps {
  selectedWeeks: Week[];
  selectedAccommodation: Accommodation | null;
  onClearWeeks: () => void;
  onClearAccommodation: () => void;
  seasonBreakdown?: SeasonBreakdown; // Optional for backward compatibility
  calculatedWeeklyAccommodationPrice: number | null;
}

// Helper function to calculate pricing details
export interface PricingDetails {
  totalNights: number;
  nightlyAccommodationRate: number;
  baseAccommodationRate: number;
  effectiveBaseRate: number;
  totalAccommodationCost: number;
  totalFoodAndFacilitiesCost: number;
  subtotal: number;
  durationDiscountAmount: number;
  durationDiscountPercent: number;
  weeksStaying: number; // This will now store the DISPLAY (rounded) weeks
  totalAmount: number;
  appliedCodeDiscountValue: number;
  seasonalDiscount: number;
  vatAmount: number;
  totalWithVat: number;
}

// --- Added Applied Discount Type ---
export interface AppliedDiscount {
  code: string;
  percentage_discount: number;
  applies_to: string; // Added new field
}
// --- End Added Type ---