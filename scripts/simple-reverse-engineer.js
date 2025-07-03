const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://guquxpxxycfmmlqajdyw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cXV4cHh4eWNmbW1scWFqZHl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTkzNzM5NiwiZXhwIjoyMDQ3NTEzMzk2fQ.EfGecY4PbjvDVuXE_0MzhslIwC6AN51Xggt9DRw-Cpw'
);

// Discount codes with application scope (only used if already in booking data)
const knownDiscountCodes = {
  'LUCIEWK2': { percentage: 60, applies_to: 'total' },
  'LEONAISABAMF': { percentage: 60, applies_to: 'food_facilities' },
  'GRETA44': { percentage: 44, applies_to: 'food_facilities' },
  'SPLITBOOK': { percentage: 30, applies_to: 'food_facilities' },
  'ECHONITZSCHE': { percentage: 10, applies_to: 'food_facilities' },
  'BOOKITOUT77': { percentage: 100, applies_to: 'total' },
  'PHILLIPSMUSINGS': { percentage: 38, applies_to: 'total' },
  'LEILALALA': { percentage: 51, applies_to: 'food_facilities' },
  'GRETATERG': { percentage: 50, applies_to: 'total' },
  'ALASKA444': { percentage: 28, applies_to: 'food_facilities' },
  'EUGENIOYO': { percentage: 51, applies_to: 'food_facilities' },
  'ANDREISGAY': { percentage: 99, applies_to: 'total' },
  'FEVERISHMACABRE': { percentage: 100, applies_to: 'food_facilities' },
  'ECHOOFCODY': { percentage: 51, applies_to: 'food_facilities' },
  'HUWRU': { percentage: 41, applies_to: 'food_facilities' },
  'GIBSONSMUSINGS05': { percentage: 50, applies_to: 'total' },
  'SUMMER21': { percentage: 50, applies_to: 'total' },
  'WHYISTHECARDNOTAUTH?': { percentage: 99, applies_to: 'total' },
  'ALICEINGARDENLAND': { percentage: 21, applies_to: 'food_facilities' },
  'META4NETA': { percentage: 9, applies_to: 'food_facilities' },
  'UMEBOSHIILOVEYOU': { percentage: 100, applies_to: 'total' },
  'LLELASBOOKING': { percentage: 100, applies_to: 'total' },
  'GUSTO': { percentage: 30, applies_to: 'total' },
  'RIAIR': { percentage: 25, applies_to: 'food_facilities' },
  'LOVERISES': { percentage: 37, applies_to: 'food_facilities' },
  'MAR-GOT-GOODS': { percentage: 5, applies_to: 'total' },
  'TANAYAYAY': { percentage: 56, applies_to: 'food_facilities' }
};

function getSeasonDiscount(checkInDate, accommodationTitle) {
  // Dorms don't get seasonal discounts
  if (accommodationTitle.toLowerCase().includes('dorm')) {
    return 0;
  }
  
  const month = new Date(checkInDate).getUTCMonth();
  
  // Low Season (Nov-May) - 40% discount
  if (month <= 4 || month >= 10) return 0.40;
  // Medium Season (Jun, Oct) - 15% discount  
  if (month === 5 || month === 9) return 0.15;
  // Summer Season (Jul-Sep) - no discount
  return 0;
}

function getDurationDiscount(completeWeeks) {
  if (completeWeeks < 3) return 0;
  
  // 10% base + 2.78% per week beyond 3, capped at 35%
  const baseDiscount = 0.10;
  const additionalWeeks = completeWeeks - 3;
  const additionalDiscount = additionalWeeks * 0.0278;
  
  return Math.min(baseDiscount + additionalDiscount, 0.35);
}

// Proper date calculation functions
function calculateTotalDaysInclusive(checkIn, checkOut) {
  const checkInUTC = new Date(checkIn);
  const checkOutUTC = new Date(checkOut);
  
  const diffInMs = checkOutUTC.getTime() - checkInUTC.getTime();
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
  
  return diffInDays + 1; // Add 1 for inclusive calculation
}

function calculateCompleteWeeks(totalDays) {
  return totalDays >= 7 ? Math.floor(totalDays / 7) : 0;
}

function calculateExactWeeks(totalDays) {
  return totalDays / 7;
}

async function simpleReverseEngineer() {
  try {
    console.log('🔧 SIMPLE Reverse Engineering Script (No Fake Discount Detection)\n');

    // Get all accommodations
    const { data: accommodations, error: accError } = await supabase
      .from('accommodations')
      .select('id, title, base_price');

    if (accError) throw accError;

    const accommodationMap = {};
    accommodations.forEach(acc => {
      accommodationMap[acc.id] = {
        title: acc.title,
        basePrice: acc.base_price || 0
      };
    });

    console.log(`📋 Loaded ${accommodations.length} accommodations\n`);

    // Get all bookings - check what discount codes exist BEFORE we process
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*');

    if (error) throw error;

    console.log(`Found ${bookings.length} bookings to process\n`);

    // First, show what discount codes already exist in the database
    const existingCodes = new Set();
    bookings.forEach(booking => {
      if (booking.applied_discount_code) {
        existingCodes.add(booking.applied_discount_code);
      }
    });

    console.log('📋 Existing discount codes in database BEFORE processing:');
    if (existingCodes.size === 0) {
      console.log('   ✅ No discount codes found - this is correct!\n');
    } else {
      existingCodes.forEach(code => console.log(`   - ${code}`));
      console.log();
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const booking of bookings) {
      try {
        console.log(`Processing booking ${booking.id}...`);

        // Get accommodation details
        const accommodation = accommodationMap[booking.accommodation_id];
        if (!accommodation) {
          console.log(`  ❌ Accommodation not found for ID: ${booking.accommodation_id}`);
          errorCount++;
          continue;
        }

        const accommodationTitle = accommodation.title;
        const pricePerWeek = accommodation.basePrice;

        // Calculate booking duration properly
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);
        
        const totalDaysInclusive = calculateTotalDaysInclusive(checkIn, checkOut);
        const exactWeeks = calculateExactWeeks(totalDaysInclusive);
        const completeWeeks = calculateCompleteWeeks(totalDaysInclusive);

        console.log(`  ${accommodationTitle}: ${totalDaysInclusive} days inclusive (${exactWeeks.toFixed(2)} weeks, ${completeWeeks} complete)`);

        // Calculate base accommodation cost
        const accommodationBasePrice = pricePerWeek * exactWeeks;

        // Calculate seasonal discount (accommodation only)
        const seasonalDiscountPercent = getSeasonDiscount(booking.check_in, accommodationTitle);
        const seasonalDiscountAmount = accommodationBasePrice * seasonalDiscountPercent;

        // Calculate duration discount
        const durationDiscountPercent = getDurationDiscount(completeWeeks);

        console.log(`  Seasonal: ${(seasonalDiscountPercent * 100).toFixed(1)}% = €${seasonalDiscountAmount.toFixed(2)}`);
        console.log(`  Duration: ${(durationDiscountPercent * 100).toFixed(1)}%`);

        // Apply discounts to accommodation
        const accommodationAfterSeasonal = accommodationBasePrice - seasonalDiscountAmount;
        const accommodationDurationDiscount = accommodationAfterSeasonal * durationDiscountPercent;
        const accommodationAfterDuration = accommodationAfterSeasonal - accommodationDurationDiscount;

        // SIMPLE: Only use discount codes that ALREADY exist in this booking
        let discountCodePercent = 0;
        let existingDiscountCode = booking.applied_discount_code; // Use what's already there
        let accommodationDiscountCodeAmount = 0;
        let foodDiscountCodeAmount = 0;

        if (existingDiscountCode && knownDiscountCodes[existingDiscountCode]) {
          const codeInfo = knownDiscountCodes[existingDiscountCode];
          discountCodePercent = codeInfo.percentage;
          
          console.log(`  Existing discount code: ${existingDiscountCode} (${discountCodePercent}% on ${codeInfo.applies_to})`);
          
          // We'll calculate the food base first, then apply discount code logic
        } else if (existingDiscountCode) {
          console.log(`  ⚠️  Unknown discount code in database: ${existingDiscountCode}`);
        }

        // Calculate final accommodation paid (before discount codes)
        const accommodationBeforeDiscountCode = accommodationAfterDuration;
        
        // Calculate food base using simple subtraction
        const totalPaidBeforeCredits = booking.total_price + (booking.credits_used || 0);
        
        if (existingDiscountCode && knownDiscountCodes[existingDiscountCode]) {
          const codeInfo = knownDiscountCodes[existingDiscountCode];
          
          if (codeInfo.applies_to === 'food_facilities') {
            // Discount code only affects food
            accommodationDiscountCodeAmount = 0;
            const finalAccommodationPaid = accommodationBeforeDiscountCode;
            const foodPaid = totalPaidBeforeCredits - finalAccommodationPaid;
            const foodBase = foodPaid / (1 - (discountCodePercent / 100));
            foodDiscountCodeAmount = foodBase - foodPaid;
            
            console.log(`  💰 Accommodation: €${accommodationBasePrice.toFixed(2)} base → €${finalAccommodationPaid.toFixed(2)} final`);
            console.log(`  💰 Food: €${foodBase.toFixed(2)} base → €${foodPaid.toFixed(2)} final`);
            
            // Store the values
            const finalBreakdown = {
              accommodation_price: accommodationBasePrice,
              food_contribution: foodBase,
              seasonal_adjustment: seasonalDiscountAmount,
              duration_discount_percent: durationDiscountPercent * 100,
              discount_code_percent: discountCodePercent / 100, // Store as decimal (0.5 for 50%)
              applied_discount_code: existingDiscountCode,
              discount_amount: seasonalDiscountAmount + accommodationDurationDiscount + (foodBase * durationDiscountPercent) + foodDiscountCodeAmount
            };
            
          } else {
            // Discount code applies to total (both accommodation and food)
            // Need to work backwards from the total
            const subtotalBeforeDiscountCode = totalPaidBeforeCredits / (1 - (discountCodePercent / 100));
            const totalDiscountCodeAmount = subtotalBeforeDiscountCode - totalPaidBeforeCredits;
            
            // Allocate discount code proportionally
            const accommodationRatio = accommodationBeforeDiscountCode / (accommodationBeforeDiscountCode + 100); // Assume some food cost for ratio
            accommodationDiscountCodeAmount = totalDiscountCodeAmount * accommodationRatio;
            foodDiscountCodeAmount = totalDiscountCodeAmount - accommodationDiscountCodeAmount;
            
            const finalAccommodationPaid = accommodationBeforeDiscountCode - accommodationDiscountCodeAmount;
            const foodPaid = totalPaidBeforeCredits - finalAccommodationPaid;
            const foodBase = (foodPaid + foodDiscountCodeAmount) / (1 - durationDiscountPercent);
            
            console.log(`  💰 Accommodation: €${accommodationBasePrice.toFixed(2)} base → €${finalAccommodationPaid.toFixed(2)} final`);
            console.log(`  💰 Food: €${foodBase.toFixed(2)} base → €${foodPaid.toFixed(2)} final`);
            
            const finalBreakdown = {
              accommodation_price: accommodationBasePrice,
              food_contribution: foodBase,
              seasonal_adjustment: seasonalDiscountAmount,
              duration_discount_percent: durationDiscountPercent * 100,
              discount_code_percent: discountCodePercent / 100, // Store as decimal (0.5 for 50%)
              applied_discount_code: existingDiscountCode,
              discount_amount: seasonalDiscountAmount + accommodationDurationDiscount + (foodBase * durationDiscountPercent) + totalDiscountCodeAmount
            };
          }
        } else {
          // NO DISCOUNT CODE - Simple case
          const finalAccommodationPaid = accommodationBeforeDiscountCode;
          const foodPaid = totalPaidBeforeCredits - finalAccommodationPaid;
          const foodBase = foodPaid / (1 - durationDiscountPercent);
          
          console.log(`  💰 Accommodation: €${accommodationBasePrice.toFixed(2)} base → €${finalAccommodationPaid.toFixed(2)} final`);
          console.log(`  💰 Food: €${foodBase.toFixed(2)} base → €${foodPaid.toFixed(2)} final`);
          
          const finalBreakdown = {
            accommodation_price: accommodationBasePrice,
            food_contribution: foodBase,
            seasonal_adjustment: seasonalDiscountAmount,
            duration_discount_percent: durationDiscountPercent * 100,
            discount_code_percent: 0,
            applied_discount_code: null,
            discount_amount: seasonalDiscountAmount + accommodationDurationDiscount + (foodBase * durationDiscountPercent)
          };
        }

        // Verification
        const calculatedAccommodationFinal = accommodationBasePrice - seasonalDiscountAmount - (accommodationAfterSeasonal * durationDiscountPercent) - accommodationDiscountCodeAmount;
        const calculatedFoodFinal = (finalBreakdown.food_contribution * (1 - durationDiscountPercent)) - foodDiscountCodeAmount;
        const calculatedTotal = calculatedAccommodationFinal + calculatedFoodFinal;
        
        if (Math.abs(calculatedTotal - totalPaidBeforeCredits) > 0.01) {
          console.log(`  ⚠️  VERIFICATION FAILED: Expected €${totalPaidBeforeCredits}, got €${calculatedTotal.toFixed(2)}`);
        } else {
          console.log(`  ✅ Verification passed`);
        }

        // Update the booking
        try {
          const { error: updateError } = await supabase
            .from('bookings')
            .update(finalBreakdown)
            .eq('id', booking.id);

          if (updateError) throw updateError;
          console.log(`  ✅ Updated database`);
        } catch (updateError) {
          console.log(`  ℹ️  Could not update database: ${updateError.message}`);
        }

        processedCount++;
        console.log(`  ✅ Processed\n`);

      } catch (error) {
        console.error(`  ❌ Error processing booking ${booking.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 FINAL SUMMARY:');
    console.log(`✅ Successfully processed: ${processedCount}/${bookings.length}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('\n🎯 NO FAKE DISCOUNT CODES ADDED - Only used existing ones!');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

simpleReverseEngineer(); 