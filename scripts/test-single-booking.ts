import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { reverseEngineerBooking } from './reverse-engineer-booking-breakdowns';
import { resolve } from 'path';

// Load environment variables from .env file explicitly
console.log('🔧 Current working directory:', process.cwd());
console.log('🔧 __dirname:', __dirname);

// Try multiple paths for .env file
const envPaths = [
  './.env',
  resolve(process.cwd(), '.env'),
  resolve(__dirname, '.env')
];

let envLoaded = false;
for (const envPath of envPaths) {
  console.log(`🔧 Trying to load .env from: ${envPath}`);
  const envResult = config({ path: envPath });
  if (!envResult.error) {
    console.log('✅ .env loaded successfully from:', envPath);
    envLoaded = true;
    break;
  } else {
    console.log('❌ Failed to load from:', envPath, '- Error:', envResult.error.message);
  }
}

if (!envLoaded) {
  console.log('⚠️  Could not load .env file from any path');
}

// Initialize Supabase client
console.log('🔍 Checking environment variables...');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');

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

async function testSingleBooking() {
  const bookingId = process.argv[2];
  
  if (!bookingId) {
    console.error('Usage: npm run test-breakdown <booking-id>');
    console.error('Example: npm run test-breakdown ada89b1d-38cf-4c1c-9fcd-d3bc96e93fb9');
    process.exit(1);
  }

  console.log(`🧪 Testing reverse engineering for booking: ${bookingId}\n`);

  try {
    // Fetch the specific booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Booking not found:', bookingError?.message || 'No data returned');
      return;
    }

    // Fetch the accommodation
    const { data: accommodation, error: accomError } = await supabase
      .from('accommodations')
      .select('id, title, base_price, type')
      .eq('id', booking.accommodation_id)
      .single();

    if (accomError || !accommodation) {
      console.error('❌ Accommodation not found:', accomError?.message || 'No data returned');
      return;
    }

    console.log(`📊 Current Booking Data:`);
    console.log(`   Accommodation: ${accommodation.title} (€${accommodation.base_price})`);
    console.log(`   Check-in: ${booking.check_in}`);
    console.log(`   Check-out: ${booking.check_out}`);
    console.log(`   Total Price: €${booking.total_price}`);
    console.log(`   Discount Amount: €${booking.discount_amount}`);
    console.log(`   Credits Used: €${booking.credits_used}`);
    console.log(`   Applied Code: ${booking.applied_discount_code || 'None'}`);
    console.log(`\n📋 Current Breakdown Fields:`);
    console.log(`   accommodation_price: ${booking.accommodation_price ?? 'NULL'}`);
    console.log(`   food_contribution: ${booking.food_contribution ?? 'NULL'}`);
    console.log(`   seasonal_adjustment: ${booking.seasonal_adjustment ?? 'NULL'}`);
    console.log(`   duration_discount_percent: ${booking.duration_discount_percent ?? 'NULL'}`);
    console.log(`   discount_code_percent: ${booking.discount_code_percent ?? 'NULL'}`);

    // Run the reverse engineering
    const breakdown = await reverseEngineerBooking(booking, accommodation);

    console.log(`\n🎯 Proposed Updates:`);
    Object.entries(breakdown).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });

    console.log(`\n✅ Test completed successfully!`);
    console.log(`\n💡 To apply this to all bookings, run: npm run reverse-engineer`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSingleBooking().catch(console.error); 