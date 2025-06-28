// supabase/functions/calculate-booking-price/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { differenceInDays, parseISO } from "https://esm.sh/date-fns@2.29.3";

console.log("Calculate Booking Price function booting up...");

// --- Replicated/Adapted Date Utils --- TODO: Consider moving to a shared backend utils file

// Normalizes a Date object to UTC midnight
function normalizeToUTCDate(date: Date): Date {
  const newDate = new Date(date);
  newDate.setUTCHours(0, 0, 0, 0);
  return newDate;
}

// Calculates total nights between two dates (exclusive of checkout day)
function calculateTotalNights(checkIn: Date, checkOut: Date): number {
  const normCheckIn = normalizeToUTCDate(checkIn);
  const normCheckOut = normalizeToUTCDate(checkOut);
  if (normCheckOut <= normCheckIn) return 0;
  // FIXED: Use millisecond-based calculation to avoid DST issues
  const timeDiff = normCheckOut.getTime() - normCheckIn.getTime();
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
}

// Calculates the number of *complete* weeks for duration discount
function calculateDurationDiscountWeeks(totalNights: number): number {
  if (totalNights < 0) return 0;
  return Math.floor(totalNights / 7);
}

// Calculates the precise number of weeks as a decimal
function calculateTotalWeeksDecimal(totalNights: number): number {
  if (totalNights <= 0) return 0;
  return totalNights / 7;
}

// --- Replicated/Adapted Pricing Utils --- TODO: Consider moving to a shared backend utils file

interface SeasonInfo {
  name: string;
  baseDiscount: number;
}

// Helper function to centralize season logic based solely on date
function _getSeasonInfoByDate(date: Date): SeasonInfo {
  const month = date.getUTCMonth(); // 0 = January, 11 = December
  // Low Season (Nov-May) -> months 10, 11, 0, 1, 2, 3, 4
  if (month >= 10 || month <= 4) return { name: "Low Season", baseDiscount: 0.40 };
  // Medium Season (June, Oct) -> months 5, 9
  if (month === 5 || month === 9) return { name: "Medium Season", baseDiscount: 0.15 };
  // Summer Season (July, Aug, Sep) -> months 6, 7, 8
  return { name: "Summer Season", baseDiscount: 0 };
}

// Determines the duration discount percentage based on *complete* weeks
function getDurationDiscount(completeWeeks: number): number {
  if (completeWeeks < 3) return 0;
  const baseDiscount = 0.10; // 10% for 3 weeks
  const extraWeeks = completeWeeks - 3;
  const extraDiscount = extraWeeks * 0.0278; // 2.78% per additional week
  const roundedDiscount = Math.round((baseDiscount + extraDiscount) * 100) / 100;
  return Math.min(roundedDiscount, 0.35); // Cap at 35%
}

interface SeasonBreakdownResult {
  hasMultipleSeasons: boolean;
  seasons: { name: string; discount: number; nights: number }[];
}

// Calculates the breakdown of nights per season within a date range
function getSeasonBreakdown(checkIn: Date, checkOut: Date): SeasonBreakdownResult {
  const normCheckIn = normalizeToUTCDate(checkIn);
  const normCheckOut = normalizeToUTCDate(checkOut);

  const seasonMap: Record<string, { name: string; discount: number; nights: number }> = {
    "Low Season-0.4": { name: "Low Season", discount: 0.4, nights: 0 },
    "Medium Season-0.15": { name: "Medium Season", discount: 0.15, nights: 0 },
    "Summer Season-0": { name: "Summer Season", discount: 0, nights: 0 },
  };

  if (normCheckOut <= normCheckIn) {
    return { hasMultipleSeasons: false, seasons: [] };
  }

  let currentDay = new Date(normCheckIn);
  while (currentDay < normCheckOut) {
    const seasonInfo = _getSeasonInfoByDate(currentDay);
    const key = `${seasonInfo.name}-${seasonInfo.baseDiscount}`;
    if (seasonMap[key]) {
      seasonMap[key].nights++;
    } else {
        console.error(`[PriceCalc] Encountered unexpected season key: ${key} for date ${currentDay.toISOString()}`);
    }
    currentDay.setUTCDate(currentDay.getUTCDate() + 1);
  }

  const seasonsWithNights = Object.values(seasonMap).filter((s) => s.nights > 0);
  const hasMultipleSeasons = seasonsWithNights.length > 1;

  return { hasMultipleSeasons, seasons: seasonsWithNights };
}

// Calculates the average seasonal discount percentage over the period
function calculateAverageSeasonalDiscount(seasonBreakdown: SeasonBreakdownResult): number {
    if (!seasonBreakdown || seasonBreakdown.seasons.length === 0) return 0;

    const totalNights = seasonBreakdown.seasons.reduce((sum, s) => sum + s.nights, 0);
    if (totalNights === 0) return 0;

    const weightedDiscountSum = seasonBreakdown.seasons.reduce(
        (sum, season) => sum + (season.discount * season.nights),
        0
    );

    return weightedDiscountSum / totalNights;
}

// Calculates the final weekly accommodation price after seasonal and duration discounts
function calculateWeeklyAccommodationPrice(
  basePrice: number,
  accommodationType: string,
  averageSeasonalDiscount: number,
  durationDiscountPercent: number
): number {

  // Dorms don't get seasonal discounts
  const effectiveSeasonalDiscount = accommodationType?.toLowerCase().includes("dorm")
    ? 0
    : averageSeasonalDiscount;

  if (basePrice === 0) return 0;

  const finalPrice = basePrice * (1 - effectiveSeasonalDiscount) * (1 - durationDiscountPercent);
  return Math.round(finalPrice); // Round to nearest integer as per frontend logic
}

// --- Main Function Handler ---

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let accommodationId: string | null = null;
  let checkInDateStr: string | null = null;
  let checkOutDateStr: string | null = null;
  let foodContribution: number | null = null;
  const warnings: string[] = [];

  // --- Parse Request Body ---
  try {
    const body = await req.json();
    console.log("[PriceCalc] Request body:", body);
    if (!body || typeof body !== "object") throw new Error("Invalid JSON body.");

    accommodationId = typeof body.accommodationId === "string" ? body.accommodationId.trim() : null;
    checkInDateStr = typeof body.checkInDate === "string" ? body.checkInDate.trim() : null;
    checkOutDateStr = typeof body.checkOutDate === "string" ? body.checkOutDate.trim() : null;
    foodContribution = typeof body.foodContribution === "number" && !isNaN(body.foodContribution)
                         ? body.foodContribution
                         : null;

    if (!accommodationId) throw new Error("Missing or invalid 'accommodationId'.");
    if (!checkInDateStr) throw new Error("Missing or invalid 'checkInDate'.");
    if (!checkOutDateStr) throw new Error("Missing or invalid 'checkOutDate'.");
    if (foodContribution === null || foodContribution < 0) {
        // Defaulting food contribution if missing/invalid - adjust as needed
        warnings.push("Missing or invalid 'foodContribution', using default logic based on stay length (approximated).");
        // We need totalNights to apply default logic, calculate later
    }

  } catch (error: any) {
    console.error("[PriceCalc] Error parsing request body:", error);
    return new Response(
      JSON.stringify({ error: `Invalid request: ${error.message}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  // --- Validate and Parse Dates ---
  let checkInDate: Date;
  let checkOutDate: Date;
  try {
    checkInDate = parseISO(checkInDateStr!); // Use ! as we checked for null above
    checkOutDate = parseISO(checkOutDateStr!); 

    // Check date validity
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD.");
    }
    if (checkOutDate <= checkInDate) {
        throw new Error("Check-out date must be after check-in date.");
    }
  } catch (error: any) {
     console.error("[PriceCalc] Error parsing dates:", error);
     return new Response(
      JSON.stringify({ error: `Invalid dates: ${error.message}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  // --- Calculate Core Date Metrics ---
  const totalNights = calculateTotalNights(checkInDate, checkOutDate);
  const completeWeeks = calculateDurationDiscountWeeks(totalNights);
  const exactWeeksDecimal = calculateTotalWeeksDecimal(totalNights);

  // --- Set Default Food Contribution if needed ---
  if (foodContribution === null) {
      // Replicating frontend default logic base value (before discount)
      foodContribution = totalNights <= 6 ? 345 : 240; 
      warnings.push(`Applied default food contribution: ${foodContribution} based on ${totalNights} nights.`);
  }

  // --- Create Supabase Client ---
  // Auth handled by passing headers, ANON_KEY is fine here
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  try {
    // --- Fetch Accommodation Data ---
    console.log(`[PriceCalc] Fetching accommodation ID: ${accommodationId}`);
    const { data: accommodation, error: fetchError } = await supabaseClient
      .from("accommodations")
      .select("base_price, title, type") // Only select needed fields
      .eq("id", accommodationId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // Not found
        throw new Error(`Accommodation with ID '${accommodationId}' not found.`);
      } else {
         console.error("[PriceCalc] Supabase fetch error:", fetchError);
        throw new Error(fetchError.message || "Database error fetching accommodation.");
      }
    }

    if (!accommodation) {
        // Should be caught by .single(), but belt-and-suspenders
        throw new Error(`Accommodation with ID '${accommodationId}' not found.`);
    }
     console.log("[PriceCalc] Fetched accommodation details:", accommodation);

    // --- Perform Pricing Calculations ---
    const basePrice = accommodation.base_price ?? 0;
    const accommodationType = accommodation.title ?? accommodation.type ?? ''; // Use title first for dorm check

    // 1. Seasonal Discount
    const seasonBreakdown = getSeasonBreakdown(checkInDate, checkOutDate);
    const averageSeasonalDiscount = calculateAverageSeasonalDiscount(seasonBreakdown);

    // 2. Duration Discount
    const durationDiscountPercent = getDurationDiscount(completeWeeks);

    // 3. Weekly Accommodation Price (after discounts)
    const finalWeeklyAccommodationPrice = calculateWeeklyAccommodationPrice(
        basePrice,
        accommodationType,
        averageSeasonalDiscount,
        durationDiscountPercent
    );

    // 4. Total Accommodation Cost
    const totalAccommodationCost = parseFloat((finalWeeklyAccommodationPrice * exactWeeksDecimal).toFixed(2));

    // 5. Food & Facilities Cost (Apply duration discount to contribution)
    // Mimic frontend WYSIWYG: Rounded weekly display cost * decimal weeks
    const baseWeeklyRateForFoodCalc = foodContribution; // Use the provided/defaulted contribution
    const displayedWeeklyFFCost = Math.round(baseWeeklyRateForFoodCalc * (1 - durationDiscountPercent));
    const totalFoodAndFacilitiesCost = parseFloat((displayedWeeklyFFCost * exactWeeksDecimal).toFixed(2));

    // 6. Subtotal (Before specific discount code)
    const subtotal = parseFloat((totalAccommodationCost + totalFoodAndFacilitiesCost).toFixed(2));

    console.log("[PriceCalc] Calculation complete:", {
        subtotal,
        totalAccommodationCost,
        totalFoodAndFacilitiesCost,
        durationDiscountPercent,
        averageSeasonalDiscount
    });

    // --- Success Response ---
    return new Response(
      JSON.stringify({
        subtotal: subtotal < 0 ? 0 : subtotal, // Ensure non-negative
        totalAccommodationCost,
        totalFoodAndFacilitiesCost,
        durationDiscountPercent: durationDiscountPercent * 100, // Return as percentage
        seasonalDiscountApplied: averageSeasonalDiscount * 100, // Return as percentage
        warnings: warnings.length > 0 ? warnings : undefined, // Only include if warnings exist
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("[PriceCalc] Error during price calculation:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to calculate price due to an internal error." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}); 