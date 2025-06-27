const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://guquxpxxycfmmlqajdyw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cXV4cHh4eWNmbW1scWFqZHl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTkzNzM5NiwiZXhwIjoyMDQ3NTEzMzk2fQ.EfGecY4PbjvDVuXE_0MzhslIwC6AN51Xggt9DRw-Cpw'
);

async function cleanupFakeDiscountCodes() {
  try {
    console.log('🧹 CLEANUP: Removing fake discount codes added by reverse engineering script\n');

    // Clear the fake discount code fields I added
    const { data: result, error } = await supabase
      .from('bookings')
      .update({
        applied_discount_code: null,
        discount_code_percent: null
      })
      .not('applied_discount_code', 'is', null);

    if (error) throw error;

    console.log(`✅ Cleared fake discount codes from all bookings`);
    console.log(`📊 Rows affected: ${result?.length || 'unknown'}`);
    
    console.log('\n🎯 CLEANUP COMPLETE');
    console.log('Now the database is back to its original state before the fake discount codes were added.');
    console.log('You can run the corrected script that only uses existing discount codes.');

  } catch (error) {
    console.error('💥 Cleanup error:', error);
  }
}

cleanupFakeDiscountCodes(); 