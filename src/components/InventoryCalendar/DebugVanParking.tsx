import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function DebugVanParking() {
  const [vanParkingBookings, setVanParkingBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVanParkingData() {
      try {
        // Get Van Parking accommodation ID
        const { data: vanParkingAccom, error: accomError } = await supabase
          .from('accommodations')
          .select('*')
          .eq('title', 'Van Parking')
          .single();

        if (accomError) {
          console.error('Error fetching Van Parking accommodation:', accomError);
          return;
        }

        console.log('Van Parking Accommodation:', vanParkingAccom);

        // Get all Van Parking bookings - join is optional since accommodation_item_id can be null
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            *,
            accommodation_items(
              id,
              full_tag
            )
          `)
          .eq('accommodation_id', vanParkingAccom.id)
          .eq('status', 'confirmed');

        if (bookingsError) {
          console.error('Error fetching Van Parking bookings:', bookingsError);
          return;
        }

        console.log('Van Parking Bookings:', bookings);
        setVanParkingBookings(bookings || []);

        // Also check bookings_with_items view
        const { data: bookingsWithItems, error: viewError } = await supabase
          .from('bookings_with_items')
          .select('*')
          .eq('accommodation_id', vanParkingAccom.id)
          .eq('status', 'confirmed');

        if (!viewError) {
          console.log('Van Parking from bookings_with_items view:', bookingsWithItems);
        }

        // Check if there are any Van Parking tags
        const { data: vanParkingTags, error: tagsError } = await supabase
          .from('accommodation_items')
          .select('*')
          .eq('accommodation_id', vanParkingAccom.id);

        if (!tagsError) {
          console.log('Van Parking Tags:', vanParkingTags);
        }
        
        // Also check the view that includes titles
        const { data: vanParkingTagsWithTitles, error: viewTagsError } = await supabase
          .from('accommodation_items_with_tags')
          .select('*')
          .eq('accommodation_id', vanParkingAccom.id);

        if (!viewTagsError) {
          console.log('Van Parking Tags with titles from view:', vanParkingTagsWithTitles);
        }

      } catch (err) {
        console.error('Error in debug component:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchVanParkingData();
  }, []);

  if (loading) return <div>Loading Van Parking debug info...</div>;

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded shadow-lg max-w-md max-h-96 overflow-auto z-[100]">
      <h3 className="font-bold mb-2">Van Parking Debug Info</h3>
      <div className="text-xs space-y-2">
        <div>Total Van Parking bookings: {vanParkingBookings.length}</div>
        {vanParkingBookings.map(booking => (
          <div key={booking.id} className="border-t pt-2">
            <div>Guest: {booking.guest_name || booking.guest_email}</div>
            <div>Check-in: {new Date(booking.check_in).toLocaleDateString()}</div>
            <div>Check-out: {new Date(booking.check_out).toLocaleDateString()}</div>
            <div>Item ID: {booking.accommodation_item_id || 'UNASSIGNED'}</div>
            <div>Tag: {booking.accommodation_items?.full_tag || 'No tag'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}