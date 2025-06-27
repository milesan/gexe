const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://guquxpxxycfmmlqajdyw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cXV4cHh4eWNmbW1scWFqZHl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTkzNzM5NiwiZXhwIjoyMDQ3NTEzMzk2fQ.EfGecY4PbjvDVuXE_0MzhslIwC6AN51Xggt9DRw-Cpw'
);

function getSeasonDiscount(checkInDate, accommodationTitle) {
  if (accommodationTitle.toLowerCase().includes('dorm')) {
    return 0;
  }
  
  const month = new Date(checkInDate).getUTCMonth();
  
  if (month <= 4 || month >= 10) return 0.40; // Low Season (Nov-May)
  if (month === 5 || month === 9) return 0.15; // Medium Season (Jun, Oct)
  return 0; // Summer Season (Jul-Sep)
}

function getDurationDiscount(completeWeeks) {
  if (completeWeeks < 3) return 0;
  
  const baseDiscount = 0.10;
  const additionalWeeks = completeWeeks - 3;
  const additionalDiscount = additionalWeeks * 0.0278;
  
  return Math.min(baseDiscount + additionalDiscount, 0.35);
}

function calculateTotalDaysInclusive(checkIn, checkOut) {
  const checkInUTC = new Date(checkIn);
  const checkOutUTC = new Date(checkOut);
  const diffInMs = checkOutUTC.getTime() - checkInUTC.getTime();
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
  return diffInDays + 1; // Add 1 for inclusive calculation
}

async function deadSimpleReverseEngineer() {
  try {
    console.log('🔧 DEAD SIMPLE Reverse Engineering Script\n');
    console.log('✅ NO discount code detection - just basic math!\n');

    // Get accommodations
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

    // Get all bookings
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*');

    if (error) throw error;

    console.log(`Found ${bookings.length} bookings to process\n`);

    let processedCount = 0;
    let errorCount = 0;

    for (const booking of bookings) {
      try {
        console.log(`Processing booking ${booking.id}...`);

        const accommodation = accommodationMap[booking.accommodation_id];
        if (!accommodation) {
          console.log(`  ❌ Accommodation not found`);
          errorCount++;
          continue;
        }

        const accommodationTitle = accommodation.title;
        const pricePerWeek = accommodation.basePrice;

        // Calculate duration
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);
        const totalDaysInclusive = calculateTotalDaysInclusive(checkIn, checkOut);
        const exactWeeks = totalDaysInclusive / 7;
        const completeWeeks = totalDaysInclusive >= 7 ? Math.floor(totalDaysInclusive / 7) : 0;

        console.log(`  ${accommodationTitle}: ${totalDaysInclusive} days (${exactWeeks.toFixed(2)} weeks)`);

        // Calculate accommodation costs
        const accommodationBasePrice = pricePerWeek * exactWeeks;
        
        // Apply seasonal discount
        const seasonalDiscountPercent = getSeasonDiscount(booking.check_in, accommodationTitle);
        const seasonalDiscountAmount = accommodationBasePrice * seasonalDiscountPercent;
        const accommodationAfterSeasonal = accommodationBasePrice - seasonalDiscountAmount;
        
        // Apply duration discount
        const durationDiscountPercent = getDurationDiscount(completeWeeks);
        const accommodationDurationDiscount = accommodationAfterSeasonal * durationDiscountPercent;
        const accommodationAfterDuration = accommodationAfterSeasonal - accommodationDurationDiscount;

        // SIMPLE: Food = Total - Accommodation (no discount code math)
        const totalPaid = booking.total_price + (booking.credits_used || 0);
        const foodPaid = totalPaid - accommodationAfterDuration;
        
        // Reverse engineer food base (undo duration discount only)
        const foodBase = foodPaid / (1 - durationDiscountPercent);

        console.log(`  Accommodation: €${accommodationBasePrice.toFixed(2)} → €${accommodationAfterDuration.toFixed(2)}`);
        console.log(`  Food: €${foodBase.toFixed(2)} → €${foodPaid.toFixed(2)}`);
        console.log(`  Total: €${totalPaid.toFixed(2)}`);

        // Verification
        const calculatedTotal = accommodationAfterDuration + foodPaid;
        if (Math.abs(calculatedTotal - totalPaid) > 0.01) {
          console.log(`  ⚠️  MISMATCH: ${calculatedTotal.toFixed(2)} vs ${totalPaid.toFixed(2)}`);
        } else {
          console.log(`  ✅ Math checks out`);
        }

        // Update database - simple breakdown only
        const breakdown = {
          accommodation_price: accommodationBasePrice,
          food_contribution: foodBase,
          seasonal_adjustment: seasonalDiscountAmount,
          duration_discount_percent: durationDiscountPercent * 100,
          discount_code_percent: 0, // Always 0 - no detection
          applied_discount_code: null, // Always null - no detection  
          discount_amount: seasonalDiscountAmount + accommodationDurationDiscount + (foodBase * durationDiscountPercent)
        };

        const { error: updateError } = await supabase
          .from('bookings')
          .update(breakdown)
          .eq('id', booking.id);

        if (updateError) throw updateError;

        processedCount++;
        console.log(`  ✅ Updated\n`);

      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log(`✅ Processed: ${processedCount}/${bookings.length}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('\n🎯 SIMPLE APPROACH: No discount code detection, just pure math!');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

deadSimpleReverseEngineer(); 