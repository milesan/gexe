import { supabase } from '../../lib/supabase';
import { AccommodationRow } from './types';
import { SINGLE_ROOMS } from './utils';

export async function loadAccommodationsSimplified() {
  // Step 1: Get all accommodations
  const { data: accommodations, error: accError } = await supabase
    .from('accommodations')
    .select('*')
    .not('title', 'ilike', '%test%')
    .order('title');

  if (accError) throw accError;

  // Step 2: Get all accommodation items/tags
  const { data: items, error: itemsError } = await supabase
    .from('accommodation_items')
    .select('*')
    .order('full_tag');

  if (itemsError) throw itemsError;

  // Step 3: Create a map of accommodation_id to accommodation for easy lookup
  const accommodationMap = new Map();
  accommodations?.forEach(acc => {
    accommodationMap.set(acc.id, acc);
  });

  // Step 4: Build rows grouped by accommodation
  const rows: AccommodationRow[] = [];
  
  // Process each accommodation
  accommodations?.forEach(acc => {
    // Get all items for this accommodation (using accommodation_id)
    const accItems = items?.filter(item => item.accommodation_id === acc.id) || [];
    
    if (acc.title.includes('Dorm')) {
      // Special case: Dorms - create bed rows
      const bedCount = acc.title.includes('6-Bed') ? 6 : acc.title.includes('3-Bed') ? 3 : 1;
      for (let bed = 1; bed <= bedCount; bed++) {
        rows.push({
          id: `${acc.id}-bed-${bed}`,
          label: `Bed ${bed}`,
          accommodation_title: acc.title,
          accommodation_id: acc.id,
          is_bed: true,
          bed_number: bed
        });
      }
    } else if (SINGLE_ROOMS.includes(acc.title)) {
      // Single rooms - one row per room
      rows.push({
        id: acc.id,
        label: acc.title,
        accommodation_title: acc.title,
        accommodation_id: acc.id
      });
    } else if (accItems.length > 0) {
      // Has tags - create a row for each tag
      accItems.forEach(item => {
        rows.push({
          id: item.id,
          label: item.full_tag || `${acc.title} ${item.item_id}`,
          accommodation_title: acc.title, // ALWAYS use accommodation's title
          accommodation_id: acc.id,
          item_id: item.id,
          is_assigned: false // Will be updated based on bookings
        });
      });
    } else if (acc.inventory && acc.inventory > 0) {
      // Has inventory but no tags yet - create placeholder rows
      for (let i = 0; i < acc.inventory; i++) {
        rows.push({
          id: `${acc.id}-inventory-${i}`,
          label: `${acc.title} #${i + 1}`,
          accommodation_title: acc.title,
          accommodation_id: acc.id,
          is_assigned: false
        });
      }
    }
    // For unlimited accommodations (Van Parking, Your Own Tent, Staying with somebody),
    // we'll add dynamic rows later based on bookings
  });

  // Sort rows by accommodation type for consistent display
  // Order: Single Rooms, Dorms, Bell Tents/Tipis, Special (Van Parking, etc)
  const singleRoomRows = rows.filter(r => SINGLE_ROOMS.includes(r.accommodation_title));
  const dormRows = rows.filter(r => r.is_bed);
  const specialRows = rows.filter(r => 
    r.accommodation_title === 'Van Parking' ||
    r.accommodation_title === 'Your Own Tent' ||
    r.accommodation_title === 'Staying with somebody'
  );
  const otherRows = rows.filter(r => 
    !SINGLE_ROOMS.includes(r.accommodation_title) &&
    !r.is_bed &&
    r.accommodation_title !== 'Van Parking' &&
    r.accommodation_title !== 'Your Own Tent' &&
    r.accommodation_title !== 'Staying with somebody'
  );

  return [...singleRoomRows, ...dormRows, ...otherRows, ...specialRows];
}