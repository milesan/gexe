const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://guquxpxxycfmmlqajdyw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cXV4cHh4eWNmbW1scWFqZHl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTkzNzM5NiwiZXhwIjoyMDQ3NTEzMzk2fQ.EfGecY4PbjvDVuXE_0MzhslIwC6AN51Xggt9DRw-Cpw'
);

// Accommodation data (provided by user)
const ACCOMMODATION_DATA = {
  '1dc38e98-ce16-46a0-aded-98a3387e972f': { title: 'Microcabin Middle', base_price: 365 },
  '25c2a846-926d-4ac8-9cbd-f03309883e22': { title: '3-Bed Dorm', base_price: 145 },
  '277eca51-1e27-45ef-8dfe-eda4e865082e': { title: 'Valleyview Room', base_price: 534 },
  '42015935-bc3e-4963-8191-c779fd69ef13': { title: 'The Hearth', base_price: 500 },
  '43c03176-04cd-4d94-9294-72e18014e784': { title: 'Microcabin Left', base_price: 400 },
  '49b55d07-142d-4073-a9e9-62182f8fcc7d': { title: 'The Yurt', base_price: 440 },
  '4c37de6b-3982-4734-b048-02a7cc585d89': { title: 'Your Own Tent', base_price: 0 },
  '5465a343-b01a-44b9-9ede-3a8a537563be': { title: 'test', base_price: 1 },
  '74d777b7-5268-4a8e-be22-b59eb8ba663d': { title: 'Van Parking', base_price: 0 },
  '764a4530-fcee-446d-b318-a20fd48a04e6': { title: 'Writer\'s Room', base_price: 465 },
  '85737f70-cd38-40b5-8338-37d69c30906f': { title: '4 Meter Bell Tent', base_price: 270 },
  '96e9eac4-bc58-4ac1-b308-fcd472e91dcc': { title: 'Single Tipi', base_price: 165 },
  'b3226075-36e8-4884-87ea-859cfd786499': { title: 'Test Credit Deduction Room', base_price: 100 },
  'ce6b4f06-bae5-4000-96fc-70e41c2434f5': { title: 'Microcabin Right', base_price: 400 },
  'd30c5cf7-f033-449a-8cec-176b754db7ee': { title: '6-Bed Dorm', base_price: 125 },
  'e8e7b726-38d9-4243-aa8d-4dc4a6c79713': { title: 'Staying with somebody', base_price: 0 }
};

// Helper function to calculate days between dates (inclusive)
function calculateDaysInclusive(checkIn, checkOut) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  // Reset to midnight UTC for accurate day calculation
  checkInDate.setUTCHours(0, 0, 0, 0);
  checkOutDate.setUTCHours(0, 0, 0, 0);
  
  const diffInMs = checkOutDate.getTime() - checkInDate.getTime();
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
  
  // Add 1 for inclusive counting (e.g., June 28 to July 3 = 6 days)
  return diffInDays + 1;
  }
  
// Get season info based on date (from pricing.ts logic)
function getSeasonInfo(date) {
  const month = new Date(date).getUTCMonth();
  
  // Low Season (November-May)
  if (month <= 4 || month >= 10) return { name: 'Low Season', discount: 0.40 };
  
  // Medium Season (June, October)
  if (month === 5 || month === 9) return { name: 'Medium Season', discount: 0.15 };
  
  // Summer Season (July, August, September)
  return { name: 'Summer Season', discount: 0 };
}

// Calculate average seasonal discount for a date range
function calculateAverageSeasonalDiscount(checkIn, checkOut, accommodationType) {
  // Dorms don't get seasonal discounts
  if (accommodationType.toLowerCase().includes('dorm')) return 0;
  
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  let totalDiscount = 0;
  let totalNights = 0;
  
  // Iterate through each night
  let currentDate = new Date(checkInDate);
  while (currentDate < checkOutDate) {
    const seasonInfo = getSeasonInfo(currentDate);
    totalDiscount += seasonInfo.discount;
    totalNights++;
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  
  return totalNights > 0 ? totalDiscount / totalNights : 0;
}

// Get duration discount based on complete weeks (from pricing.ts)
function getDurationDiscount(completeWeeks) {
  if (completeWeeks < 3) return 0;
  
  const baseDiscount = 0.10; // 10% for 3 weeks
  const extraWeeks = completeWeeks - 3;
  const extraDiscount = extraWeeks * 0.0278; // 2.78% per additional week
  
  return Math.min(baseDiscount + extraDiscount, 0.35); // Cap at 35%
}

// Calculate F&F price range for a given number of weeks
function calculateFFRange(exactWeeks, completeWeeks) {
  const upperBoundPerWeek = 390; // Always €390
  let lowerBoundPerWeek;
  
  if (exactWeeks < 2) {
    // 1 week: €345-€390
    lowerBoundPerWeek = 345;
  } else {
    // 2+ weeks: €240-€390
    lowerBoundPerWeek = 240;
  }
    
    // Apply duration discount to lower bound
    const durationDiscountPercent = getDurationDiscount(completeWeeks);
  const adjustedLowerBoundPerWeek = lowerBoundPerWeek * (1 - durationDiscountPercent);
  
  return {
    lowerBound: adjustedLowerBoundPerWeek * exactWeeks,
    upperBound: upperBoundPerWeek * exactWeeks,
    lowerBoundPerWeek: adjustedLowerBoundPerWeek,
    upperBoundPerWeek
  };
}

async function reverseEngineerBookings() {
  try {
    console.log('🧠 New Reverse Engineering Algorithm\n');
    console.log('📋 Using provided accommodation data\n');

    // Get all bookings
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`Found ${bookings.length} bookings to process\n`);

    let processedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const booking of bookings) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Processing booking ${booking.id.substring(0,8)}...`);

        // 1. Get accommodation info
        const accommodation = ACCOMMODATION_DATA[booking.accommodation_id];
        if (!accommodation) {
          console.log(`  ❌ Accommodation not found`);
          errorCount++;
          continue;
        }

        // 2. Calculate days (inclusive)
        const totalDays = calculateDaysInclusive(booking.check_in, booking.check_out);
        const exactWeeks = totalDays / 7;
        const completeWeeks = Math.floor(exactWeeks);

        console.log(`\n📍 ${accommodation.title}`);
        console.log(`📅 ${new Date(booking.check_in).toLocaleDateString()} → ${new Date(booking.check_out).toLocaleDateString()}`);
        console.log(`⏱️  ${totalDays} days (${exactWeeks.toFixed(2)} weeks)`);

        // 3. Calculate accommodation price with discounts
        const baseAccomPerWeek = accommodation.base_price;
        const baseAccomTotal = baseAccomPerWeek * exactWeeks;
        
        // Calculate discounts
        const seasonalDiscountPercent = calculateAverageSeasonalDiscount(
          booking.check_in, 
          booking.check_out, 
          accommodation.title
        );
        const durationDiscountPercent = getDurationDiscount(completeWeeks);
        
        // Apply discounts multiplicatively
        const accomAfterSeasonal = baseAccomTotal * (1 - seasonalDiscountPercent);
        const accomAfterAllDiscounts = accomAfterSeasonal * (1 - durationDiscountPercent);

        console.log(`\n💰 ACCOMMODATION:`);
        console.log(`   Base: €${baseAccomTotal.toFixed(2)} (€${baseAccomPerWeek}/week × ${exactWeeks.toFixed(2)} weeks)`);
        if (seasonalDiscountPercent > 0) {
          console.log(`   - Seasonal discount: ${(seasonalDiscountPercent * 100).toFixed(1)}%`);
        }
        if (durationDiscountPercent > 0) {
          console.log(`   - Duration discount: ${(durationDiscountPercent * 100).toFixed(1)}%`);
        }
        console.log(`   Final: €${accomAfterAllDiscounts.toFixed(2)}`);

        // 4. Calculate F&F and discount code
        const totalPaidBeforeCredits = booking.total_price + (booking.credits_used || 0);
        const ffPaid = totalPaidBeforeCredits - accomAfterAllDiscounts;

        console.log(`\n🍽️  FOOD & FACILITIES:`);
        console.log(`   Paid: €${ffPaid.toFixed(2)}`);

        // Calculate acceptable F&F range
        const ffRange = calculateFFRange(exactWeeks, completeWeeks);
        console.log(`   Acceptable range: €${ffRange.lowerBound.toFixed(2)} - €${ffRange.upperBound.toFixed(2)}`);

        let discountCodePercent = 0;
        let ffBase = ffRange.lowerBound; // Assume they chose the lowest option
        
        if (ffPaid < ffRange.lowerBound - 1) { // Small tolerance for rounding
          // There's a discount code!
          discountCodePercent = (ffRange.lowerBound - ffPaid) / ffRange.lowerBound;
          console.log(`   💳 DISCOUNT CODE DETECTED: ${(discountCodePercent * 100).toFixed(1)}%`);
        } else if (ffPaid > ffRange.upperBound + 1) {
          // They paid more than max - use actual amount as base
          ffBase = ffPaid;
          console.log(`   ⚠️  Paid above range - using actual as base`);
        } else {
          // Within range - interpolate to find which option they chose
          ffBase = ffPaid;
          console.log(`   ✅ Within range - no discount code`);
        }

        // 5. Create breakdown for database
        const totalDiscountAmount = 
          (baseAccomTotal * seasonalDiscountPercent) + // Seasonal on accommodation
          (accomAfterSeasonal * durationDiscountPercent) + // Duration on accommodation after seasonal
          (ffBase * durationDiscountPercent) + // Duration on F&F base
          (ffBase * (1 - durationDiscountPercent) * discountCodePercent); // Discount code on F&F after duration

        const breakdown = {
          accommodation_price: baseAccomTotal,
          food_contribution: ffBase,
          seasonal_adjustment: baseAccomTotal * seasonalDiscountPercent,
          duration_discount_percent: durationDiscountPercent * 100,
          discount_code_percent: discountCodePercent, // Already in decimal (0.5 for 50%)
          applied_discount_code: discountCodePercent > 0.05 ? 'UNKNOWN' : null,
          discount_amount: totalDiscountAmount
        };

        // 6. Final summary
        console.log(`\n📊 FINAL BREAKDOWN:`);
        console.log(`   Accommodation: €${baseAccomTotal.toFixed(2)} → €${accomAfterAllDiscounts.toFixed(2)}`);
        console.log(`   Food & Facilities: €${ffBase.toFixed(2)} → €${ffPaid.toFixed(2)}`);
        console.log(`   Total Paid: €${totalPaidBeforeCredits.toFixed(2)}`);
        if (booking.credits_used > 0) {
          console.log(`   Credits Used: €${booking.credits_used.toFixed(2)}`);
          console.log(`   Amount Charged: €${booking.total_price.toFixed(2)}`);
        }

        // Update database
        const { error: updateError } = await supabase
          .from('bookings')
          .update(breakdown)
          .eq('id', booking.id);

        if (updateError) throw updateError;

        processedCount++;
        results.push({
          id: booking.id.substring(0,8),
          accommodation: accommodation.title,
          days: totalDays,
          discountCode: discountCodePercent > 0.05 ? `${(discountCodePercent * 100).toFixed(1)}%` : 'None'
        });

      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 FINAL SUMMARY:');
    console.log(`✅ Processed: ${processedCount}/${bookings.length}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    // Show bookings with discount codes
    const discountBookings = results.filter(r => r.discountCode !== 'None');
    if (discountBookings.length > 0) {
      console.log(`\n💳 Bookings with discount codes: ${discountBookings.length}`);
      discountBookings.forEach(b => {
        console.log(`   - ${b.id}: ${b.accommodation} (${b.days} days) - ${b.discountCode} discount`);
      });
    }

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

reverseEngineerBookings(); 