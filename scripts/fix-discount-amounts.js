const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://guquxpxxycfmmlqajdyw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cXV4cHh4eWNmbW1scWFqZHl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTkzNzM5NiwiZXhwIjoyMDQ3NTEzMzk2fQ.EfGecY4PbjvDVuXE_0MzhslIwC6AN51Xggt9DRw-Cpw'
);

async function fixDiscountAmounts() {
  try {
    console.log('🔧 Fixing discount_amount fields...\n');
    console.log('This will ONLY update the discount_amount to remove F&F duration discount\n');

    // Get all bookings with breakdown data
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .not('accommodation_price', 'is', null)
      .not('food_contribution', 'is', null);

    if (error) throw error;

    console.log(`Found ${bookings.length} bookings with breakdown data\n`);

    let updateCount = 0;
    let skipCount = 0;

    for (const booking of bookings) {
      const {
        id,
        accommodation_price,
        food_contribution,
        seasonal_adjustment,
        duration_discount_percent,
        discount_code_percent,
        discount_amount: currentDiscountAmount
      } = booking;

      // Calculate correct discount amount
      // 1. Seasonal on accommodation
      const seasonalDiscount = seasonal_adjustment || 0;
      
      // 2. Duration on accommodation (after seasonal)
      const accommodationAfterSeasonal = accommodation_price - seasonalDiscount;
      const accommodationDurationDiscount = accommodationAfterSeasonal * ((duration_discount_percent || 0) / 100);
      
      // 3. Discount code on F&F (NO duration discount - it's baked into slider)
      const foodDiscountCodeAmount = food_contribution * ((discount_code_percent || 0) / 100);
      
      // Total correct discount amount
      const correctDiscountAmount = seasonalDiscount + accommodationDurationDiscount + foodDiscountCodeAmount;

      // Check if update is needed
      const diff = Math.abs(correctDiscountAmount - (currentDiscountAmount || 0));
      
      if (diff > 0.01) { // Only update if there's a meaningful difference
        console.log(`\nBooking ${id.substring(0,8)}:`);
        console.log(`  Current discount_amount: €${(currentDiscountAmount || 0).toFixed(2)}`);
        console.log(`  Correct discount_amount: €${correctDiscountAmount.toFixed(2)}`);
        console.log(`  Difference: €${diff.toFixed(2)}`);

        // Update only the discount_amount field
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ discount_amount: correctDiscountAmount })
          .eq('id', id);

        if (updateError) {
          console.error(`  ❌ Update failed: ${updateError.message}`);
        } else {
          console.log(`  ✅ Updated`);
          updateCount++;
        }
      } else {
        skipCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Updated: ${updateCount} bookings`);
    console.log(`⏭️  Skipped: ${skipCount} bookings (already correct)`);
    console.log(`📋 Total processed: ${bookings.length} bookings`);

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

fixDiscountAmounts(); 