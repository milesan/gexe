// Test script to verify the booking flow
// Run with: node scripts/test-booking-flow.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lpsdzjvyvufwqrnuafqd.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.error('❌ Please set VITE_SUPABASE_ANON_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testBookingFlow() {
  console.log('🧪 Testing Booking Flow...\n');
  
  try {
    // 1. Check for pending bookings that are stuck
    console.log('📋 Checking for stuck pending bookings...');
    const { data: pendingBookings, error: pendingError } = await supabase
      .from('bookings')
      .select('id, created_at, status, user_email, total_price')
      .eq('status', 'pending_payment')
      .lt('created_at', new Date(Date.now() - 3600000).toISOString()); // Older than 1 hour
    
    if (pendingError) {
      console.error('❌ Error checking pending bookings:', pendingError);
    } else if (pendingBookings && pendingBookings.length > 0) {
      console.log(`⚠️  Found ${pendingBookings.length} stuck pending bookings:`);
      pendingBookings.forEach(booking => {
        console.log(`   - ID: ${booking.id}, Email: ${booking.user_email}, Amount: €${booking.total_price}`);
      });
      console.log('   These should be investigated or cancelled.\n');
    } else {
      console.log('✅ No stuck pending bookings found.\n');
    }
    
    // 2. Check for bookings without payment intent (old system)
    console.log('📋 Checking for bookings without payment intent (old system)...');
    const { data: oldBookings, error: oldError } = await supabase
      .from('bookings')
      .select('id, created_at, user_email, total_price')
      .is('payment_intent_id', null)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (oldError) {
      console.error('❌ Error checking old bookings:', oldError);
    } else if (oldBookings && oldBookings.length > 0) {
      console.log(`ℹ️  Found ${oldBookings.length} recent bookings from old system:`);
      oldBookings.forEach(booking => {
        console.log(`   - ID: ${booking.id}, Date: ${booking.created_at}, Amount: €${booking.total_price}`);
      });
      console.log('   (These were created before the webhook system)\n');
    } else {
      console.log('✅ All recent bookings have payment intents.\n');
    }
    
    // 3. Check for bookings with payment but no email sent
    console.log('📋 Checking for confirmed bookings without email confirmation...');
    const { data: noEmailBookings, error: noEmailError } = await supabase
      .from('bookings')
      .select('id, user_email, created_at')
      .eq('status', 'confirmed')
      .eq('confirmation_email_sent', false)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (noEmailError) {
      console.error('❌ Error checking email status:', noEmailError);
    } else if (noEmailBookings && noEmailBookings.length > 0) {
      console.log(`⚠️  Found ${noEmailBookings.length} bookings without confirmation email:`);
      noEmailBookings.forEach(booking => {
        console.log(`   - ID: ${booking.id}, Email: ${booking.user_email}, Date: ${booking.created_at}`);
      });
      console.log('   Consider sending confirmation emails manually.\n');
    } else {
      console.log('✅ All confirmed bookings have emails sent.\n');
    }
    
    // Summary
    console.log('📊 Summary:');
    console.log('- Check Stripe webhook logs for any failed attempts');
    console.log('- Ensure STRIPE_WEBHOOK_SECRET is correctly set in Supabase');
    console.log('- Monitor Supabase function logs for errors');
    console.log('- Test with Stripe CLI: stripe listen --forward-to YOUR_WEBHOOK_URL');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBookingFlow();