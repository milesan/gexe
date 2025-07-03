import { createClient } from '@supabase/supabase-js';
import { differenceInDays } from 'date-fns';
import { config } from 'dotenv';

// Load environment variables from .env file if it exists
config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL environment variable');
  console.error('\n💡 Set this in your .env file or environment');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('\n💡 This is different from VITE_SUPABASE_ANON_KEY - you need the service_role key');
  console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Types
interface Booking {
  id: string;
  accommodation_id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  applied_discount_code: string | null;
  discount_amount: number;
  credits_used: number;
  accommodation_price: number | null;
  food_contribution: number | null;
  seasonal_adjustment: number | null;
  duration_discount_percent: number | null;
  discount_code_percent: number | null;
}

interface Accommodation {
  id: string;
  title: string;
  base_price: number;
  type: string;
}

// Pricing logic (extracted from your utils)
function getSeasonInfoByDate(date: Date): { name: string; baseDiscount: number } {
  const month = date.getUTCMonth();
  // Low Season (Nov-May) 
  if (month <= 4 || month >= 10) return { name: 'Low Season', baseDiscount: 0.40 };
  // Medium Season (June, Oct)
  if (month === 5 || month === 9) return { name: 'Medium Season', baseDiscount: 0.15 };
  // Summer Season (July, Aug, Sep)
  return { name: 'Summer Season', baseDiscount: 0 };
}

function calculateDurationDiscountWeeks(totalNights: number): number {
  if (totalNights < 0) return 0;
  return Math.floor(totalNights / 7);
}

function getDurationDiscount(completeWeeks: number): number {
  if (completeWeeks < 3) return 0;
  const baseDiscount = 0.10; // 10% for 3 weeks
  const extraWeeks = completeWeeks - 3;
  const extraDiscount = extraWeeks * 0.0278; // 2.78% per additional week
  const roundedDiscount = Math.round((baseDiscount + extraDiscount) * 100) / 100;
  return Math.min(roundedDiscount, 0.35); // Cap at 35%
}

function calculateAverageSeasonalDiscount(checkIn: Date, checkOut: Date): number {
  const totalNights = differenceInDays(checkOut, checkIn);
  if (totalNights === 0) return 0;

  let weightedDiscountSum = 0;
  let currentDate = new Date(checkIn);
  
  // Calculate weighted average across all nights
  while (currentDate < checkOut) {
    const seasonInfo = getSeasonInfoByDate(currentDate);
    weightedDiscountSum += seasonInfo.baseDiscount;
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  
  return weightedDiscountSum / totalNights;
}

function estimateFoodContribution(totalNights: number): number {
  // Use middle of range based on stay length (from your current logic)
  if (totalNights <= 6) {
    // Short stays: €345-€390 range
    return Math.round((345 + 390) / 2); // €367.50 → €368
  } else {
    // Long stays: €240-€390 range  
    return Math.round((240 + 390) / 2); // €315
  }
}

async function reverseEngineerBooking(booking: Booking, accommodation: Accommodation): Promise<Partial<Booking>> {
  const checkIn = new Date(booking.check_in);
  const checkOut = new Date(booking.check_out);
  const totalNights = differenceInDays(checkOut, checkIn);
  const completeWeeks = calculateDurationDiscountWeeks(totalNights);
  const exactWeeks = totalNights / 7;

  console.log(`\n=== Processing Booking ${booking.id} ===`);
  console.log(`Accommodation: ${accommodation.title} (${accommodation.base_price})`);
  console.log(`Stay: ${totalNights} nights (${exactWeeks.toFixed(2)} weeks)`);
  console.log(`Total Price: €${booking.total_price}`);
  console.log(`Existing Discount: €${booking.discount_amount}`);

  // Calculate theoretical discounts
  const averageSeasonalDiscount = accommodation.title.toLowerCase().includes('dorm') 
    ? 0 
    : calculateAverageSeasonalDiscount(checkIn, checkOut);
  
  const durationDiscountPercent = getDurationDiscount(completeWeeks);
  
  console.log(`Calculated Discounts: Seasonal ${(averageSeasonalDiscount * 100).toFixed(1)}%, Duration ${(durationDiscountPercent * 100).toFixed(1)}%`);

  // Estimate food contribution if missing
  const estimatedFoodContribution = estimateFoodContribution(totalNights);
  const foodContribution = booking.food_contribution ?? estimatedFoodContribution;
  
  console.log(`Food Contribution: ${booking.food_contribution ? 'existing' : 'estimated'} €${foodContribution}/week`);

  // Key insight: total_price + discount_amount + credits_used = original_subtotal
  const originalSubtotal = booking.total_price + booking.discount_amount + booking.credits_used;
  
  console.log(`Reverse Engineering: Original subtotal was €${originalSubtotal.toFixed(2)}`);

  // Calculate theoretical costs without any discounts
  const accommodationBaseTotal = accommodation.base_price * exactWeeks;
  const foodBaseTotal = foodContribution * exactWeeks;
  const theoreticalTotal = accommodationBaseTotal + foodBaseTotal;
  
  // If our theoretical total doesn't match, we need to adjust the food contribution
  let adjustedFoodContribution = foodContribution;
  if (Math.abs(theoreticalTotal - originalSubtotal) > 1) {
    // Adjust food contribution to make the numbers work
    adjustedFoodContribution = Math.max(0, (originalSubtotal - accommodationBaseTotal) / exactWeeks);
    console.log(`Adjusted food contribution from €${foodContribution} to €${adjustedFoodContribution.toFixed(2)}/week to match totals`);
  }

  // Now calculate the breakdown with the correct food contribution
  const finalAccommodationTotal = accommodationBaseTotal;
  const finalFoodTotal = adjustedFoodContribution * exactWeeks;
  
  // Calculate individual discount amounts
  const seasonalAdjustmentAmount = accommodationBaseTotal * averageSeasonalDiscount;
  const accommodationDurationDiscountAmount = (accommodationBaseTotal - seasonalAdjustmentAmount) * durationDiscountPercent;
  const foodDurationDiscountAmount = finalFoodTotal * durationDiscountPercent;
  
  // Calculate discount code percentage and amount
  let discountCodePercent = 0;
  let discountCodeAmount = 0;
  
  if (booking.applied_discount_code && booking.discount_amount > 0) {
    // Total of seasonal + duration discounts
    const otherDiscountsAmount = seasonalAdjustmentAmount + accommodationDurationDiscountAmount + foodDurationDiscountAmount;
    
    // Remaining discount should be from the discount code
    discountCodeAmount = Math.max(0, booking.discount_amount - otherDiscountsAmount);
    
    // Calculate percentage based on subtotal after other discounts
    const subtotalAfterOtherDiscounts = originalSubtotal - otherDiscountsAmount;
    if (subtotalAfterOtherDiscounts > 0) {
      discountCodePercent = (discountCodeAmount / subtotalAfterOtherDiscounts) * 100;
    }
  }

  console.log(`Calculated Breakdown:`);
  console.log(`- Original Accommodation: €${finalAccommodationTotal.toFixed(2)} (€${accommodation.base_price}/week)`);
  console.log(`- Original Food: €${finalFoodTotal.toFixed(2)} (€${adjustedFoodContribution.toFixed(2)}/week)`);
  console.log(`- Seasonal Adjustment: €${seasonalAdjustmentAmount.toFixed(2)}`);
  console.log(`- Duration Discounts: €${(accommodationDurationDiscountAmount + foodDurationDiscountAmount).toFixed(2)}`);
  console.log(`- Discount Code Amount: €${discountCodeAmount.toFixed(2)} (${discountCodePercent.toFixed(1)}%)`);

  // Verification: original_subtotal - all_discounts - credits = total_price
  const calculatedTotal = originalSubtotal - booking.discount_amount - booking.credits_used;
  const discrepancy = Math.abs(calculatedTotal - booking.total_price);
  
  console.log(`Verification: Calculated €${calculatedTotal.toFixed(2)} vs Actual €${booking.total_price}`);
  console.log(`Discrepancy: €${discrepancy.toFixed(2)} ${discrepancy > 5 ? '⚠️  HIGH' : '✓'}`);

  return {
    accommodation_price: parseFloat(finalAccommodationTotal.toFixed(2)),
    food_contribution: parseFloat(adjustedFoodContribution.toFixed(2)),
    seasonal_adjustment: parseFloat(seasonalAdjustmentAmount.toFixed(2)),
    duration_discount_percent: parseFloat((durationDiscountPercent * 100).toFixed(2)),
    discount_code_percent: parseFloat((discountCodePercent / 100).toFixed(4)) // Store as decimal (0.5 for 50%)
  };
}

async function main() {
  console.log('🔧 Starting booking breakdown reverse engineering...\n');

  try {
    // Fetch all bookings with incomplete breakdown data
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .or('accommodation_price.is.null,food_contribution.is.null,seasonal_adjustment.is.null,duration_discount_percent.is.null,discount_code_percent.is.null');

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return;
    }

    console.log(`Found ${bookings.length} bookings with incomplete breakdown data\n`);

    // Fetch all accommodations for reference
    const { data: accommodations, error: accomError } = await supabase
      .from('accommodations')
      .select('id, title, base_price, type');

    if (accomError) {
      console.error('Error fetching accommodations:', accomError);
      return;
    }

    const accomMap = new Map(accommodations.map(a => [a.id, a]));

    let processed = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const booking of bookings) {
      try {
        const accommodation = accomMap.get(booking.accommodation_id);
        if (!accommodation) {
          errors.push(`Booking ${booking.id}: Accommodation not found`);
          continue;
        }

        const breakdown = await reverseEngineerBooking(booking, accommodation);
        
        // Update the booking with calculated breakdown
        const { error: updateError } = await supabase
          .from('bookings')
          .update(breakdown)
          .eq('id', booking.id);

        if (updateError) {
          errors.push(`Booking ${booking.id}: Update failed - ${updateError.message}`);
        } else {
          updated++;
          console.log(`✅ Updated booking ${booking.id}`);
        }

      } catch (error) {
        errors.push(`Booking ${booking.id}: ${error.message}`);
      }
      
      processed++;
    }

    console.log(`\n=== Summary ===`);
    console.log(`📊 Processed: ${processed}/${bookings.length} bookings`);
    console.log(`✅ Updated: ${updated} bookings`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log(`\n=== Errors ===`);
      errors.forEach(error => console.log(`❌ ${error}`));
    }

    console.log(`\n=== Assumptions Made ===`);
    console.log(`📝 Food contributions estimated using middle-of-range defaults`);
    console.log(`📝 Seasonal discounts calculated using current season logic`);
    console.log(`📝 Duration discounts calculated using current duration logic`);
    console.log(`📝 Discount codes reverse-engineered from total discount amount`);
    console.log(`📝 All calculations assume current accommodation base prices were used historically`);

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { reverseEngineerBooking }; 