const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://guquxpxxycfmmlqajdyw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cXV4cHh4eWNmbW1scWFqZHl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTkzNzM5NiwiZXhwIjoyMDQ3NTEzMzk2fQ.EfGecY4PbjvDVuXE_0MzhslIwC6AN51Xggt9DRw-Cpw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function calculateBreakdown(booking, accommodation) {
  const checkIn = new Date(booking.check_in);
  const checkOut = new Date(booking.check_out);
  const totalNights = Math.floor((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  const exactWeeks = totalNights / 7;
  
  console.log(`📊 ${accommodation.title} - ${totalNights} nights (${exactWeeks.toFixed(2)} weeks)`);
  console.log(`   Total paid: €${booking.total_price}`);
  
  // Calculate reverse engineering: total_price + discounts + credits = original_subtotal
  const originalSubtotal = booking.total_price + (booking.discount_amount || 0) + (booking.credits_used || 0);
  const accommodationTotal = accommodation.base_price * exactWeeks;
  const foodContribution = Math.max(0, (originalSubtotal - accommodationTotal) / exactWeeks);
  
  console.log(`   → Accommodation: €${accommodationTotal.toFixed(2)} (€${accommodation.base_price}/week)`);
  console.log(`   → Food: €${foodContribution.toFixed(2)}/week`);
  
  return {
    accommodation_price: parseFloat(accommodationTotal.toFixed(2)),
    food_contribution: parseFloat(foodContribution.toFixed(2)),
    seasonal_adjustment: 0,
    duration_discount_percent: 0,
    discount_code_percent: 0
  };
}

async function main() {
  const isDryRun = process.argv[2] !== 'commit';
  
  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No database changes will be made');
    console.log('💡 Run with "commit" argument to actually update: node update-empty-bookings.js commit\n');
  } else {
    console.log('🚨 LIVE MODE - Will update database!\n');
  }

  try {
    // Find bookings with completely missing breakdown data
    console.log('🔍 Finding bookings with missing breakdown data...');
    
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .is('accommodation_price', null)
      .is('food_contribution', null);

    if (bookingsError) {
      console.error('❌ Error fetching bookings:', bookingsError);
      return;
    }

    console.log(`Found ${bookings.length} bookings with completely missing breakdown data\n`);

    if (bookings.length === 0) {
      console.log('✅ All bookings already have breakdown data!');
      return;
    }

    // Fetch accommodations
    const { data: accommodations, error: accomError } = await supabase
      .from('accommodations')
      .select('id, title, base_price, type');

    if (accomError) {
      console.error('❌ Error fetching accommodations:', accomError);
      return;
    }

    const accomMap = new Map(accommodations.map(a => [a.id, a]));

    let processed = 0;
    let updated = 0;
    const errors = [];

    for (const booking of bookings) {
      try {
        const accommodation = accomMap.get(booking.accommodation_id);
        if (!accommodation) {
          errors.push(`Booking ${booking.id}: Accommodation not found`);
          continue;
        }

        console.log(`\n[${processed + 1}/${bookings.length}] ${booking.id}`);
        const breakdown = await calculateBreakdown(booking, accommodation);
        
        if (!isDryRun) {
          // Actually update the database
          const { error: updateError } = await supabase
            .from('bookings')
            .update(breakdown)
            .eq('id', booking.id);

          if (updateError) {
            errors.push(`Booking ${booking.id}: Update failed - ${updateError.message}`);
            console.log(`   ❌ Update failed: ${updateError.message}`);
          } else {
            updated++;
            console.log(`   ✅ Updated successfully`);
          }
        } else {
          updated++; // Count what would be updated in dry run
          console.log(`   ✅ Would update with this data`);
        }

      } catch (error) {
        errors.push(`Booking ${booking.id}: ${error.message}`);
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      processed++;
    }

    console.log(`\n=== Summary ===`);
    console.log(`📊 Processed: ${processed}/${bookings.length} bookings`);
    
    if (isDryRun) {
      console.log(`✅ Would update: ${updated} bookings`);
      console.log(`❌ Errors: ${errors.length}`);
      console.log(`\n💡 Run with "commit" to actually update: node update-empty-bookings.js commit`);
    } else {
      console.log(`✅ Updated: ${updated} bookings`);
      console.log(`❌ Errors: ${errors.length}`);
      console.log(`\n🎉 Database updated successfully!`);
    }

    if (errors.length > 0) {
      console.log(`\n=== Errors ===`);
      errors.forEach(error => console.log(`❌ ${error}`));
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
}

main().catch(console.error); 