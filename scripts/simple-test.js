const { createClient } = require('@supabase/supabase-js');

// Hard-code the values for testing
const supabaseUrl = 'https://guquxpxxycfmmlqajdyw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cXV4cHh4eWNmbW1scWFqZHl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTkzNzM5NiwiZXhwIjoyMDQ3NTEzMzk2fQ.EfGecY4PbjvDVuXE_0MzhslIwC6AN51Xggt9DRw-Cpw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log('🧪 Testing Supabase connection...');
  
  try {
    const bookingId = process.argv[2] || 'ada89b1d-38cf-4c1c-9fcd-d3bc96e93fb9';
    console.log('📝 Testing with booking ID:', bookingId);
    
    // Fetch the specific booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError) {
      console.error('❌ Error fetching booking:', bookingError.message);
      return;
    }

    if (!booking) {
      console.error('❌ Booking not found');
      return;
    }

    console.log('✅ Booking found:');
    console.log('   ID:', booking.id);
    console.log('   Accommodation ID:', booking.accommodation_id);
    console.log('   Check-in:', booking.check_in);
    console.log('   Check-out:', booking.check_out);
    console.log('   Total Price:', booking.total_price);
    console.log('   Status:', booking.status);
    
    console.log('\n📊 Current Breakdown Fields:');
    console.log('   accommodation_price:', booking.accommodation_price);
    console.log('   food_contribution:', booking.food_contribution);
    console.log('   seasonal_adjustment:', booking.seasonal_adjustment);
    console.log('   duration_discount_percent:', booking.duration_discount_percent);
    console.log('   discount_code_percent:', booking.discount_code_percent);

    // Fetch accommodation info
    const { data: accommodation, error: accomError } = await supabase
      .from('accommodations')
      .select('id, title, base_price, type')
      .eq('id', booking.accommodation_id)
      .single();

    if (accomError) {
      console.error('❌ Error fetching accommodation:', accomError.message);
      return;
    }

    console.log('\n🏠 Accommodation Info:');
    console.log('   Title:', accommodation.title);
    console.log('   Base Price:', accommodation.base_price);
    console.log('   Type:', accommodation.type);

    console.log('\n✅ Connection test successful! Ready to run reverse engineering.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testConnection(); 