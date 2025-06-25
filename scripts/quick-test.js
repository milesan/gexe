const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://guquxpxxycfmmlqajdyw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cXV4cHh4eWNmbW1scWFqZHl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTkzNzM5NiwiZXhwIjoyMDQ3NTEzMzk2fQ.EfGecY4PbjvDVuXE_0MzhslIwC6AN51Xggt9DRw-Cpw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function calculateBreakdown(bookingId) {
  // Fetch booking and accommodation data
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  const { data: accommodation } = await supabase.from('accommodations').select('*').eq('id', booking.accommodation_id).single();
  
  const checkIn = new Date(booking.check_in);
  const checkOut = new Date(booking.check_out);
  const totalNights = Math.floor((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  const exactWeeks = totalNights / 7;
  
  console.log('Booking:', booking.id);
  console.log('Accommodation:', accommodation.title, '(€' + accommodation.base_price + ')');
  console.log('Stay:', totalNights, 'nights (' + exactWeeks.toFixed(2) + ' weeks)');
  console.log('Total Price: €' + booking.total_price);
  
  // Calculate reverse engineering
  const originalSubtotal = booking.total_price + (booking.discount_amount || 0) + (booking.credits_used || 0);
  const accommodationTotal = accommodation.base_price * exactWeeks;
  const foodContribution = Math.max(0, (originalSubtotal - accommodationTotal) / exactWeeks);
  
  console.log('Original Subtotal: €' + originalSubtotal.toFixed(2));
  console.log('Accommodation Cost: €' + accommodationTotal.toFixed(2));
  console.log('Food Contribution: €' + foodContribution.toFixed(2) + '/week');
  
  return {
    accommodation_price: accommodationTotal,
    food_contribution: foodContribution,
    seasonal_adjustment: 0,
    duration_discount_percent: 0,
    discount_code_percent: 0
  };
}

calculateBreakdown(process.argv[2] || 'ada89b1d-38cf-4c1c-9fcd-d3bc96e93fb9').then(result => {
  console.log('Calculated breakdown:', result);
}).catch(console.error);
