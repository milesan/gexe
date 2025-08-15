import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function TestDormBookings() {
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    async function test() {
      // Test the exact query used in loadBookings
      const { data: bookingsData, error } = await supabase
        .from('bookings_with_items')
        .select(`
          id,
          check_in,
          check_out,
          status,
          guest_email,
          accommodation_id,
          accommodation_item_id,
          item_tag,
          accommodations!inner(title)
        `)
        .eq('status', 'confirmed')
        .gte('check_out', '2025-10-01')
        .lte('check_in', '2025-10-31');
      
      console.log('Dorm bookings test:', { bookingsData, error });
      
      // Filter for dorm bookings
      const dormBookings = bookingsData?.filter(b => 
        b.accommodations?.title?.includes('Dorm')
      );
      
      setData({ 
        allBookings: bookingsData, 
        dormBookings,
        error 
      });
    }
    
    test();
  }, []);
  
  if (!data) return null;
  
  return (
    <div className="fixed top-20 right-4 bg-purple-900/90 text-white p-4 rounded-lg text-xs max-w-lg">
      <h3 className="font-bold mb-2">Dorm Bookings Test</h3>
      <div>Total bookings in Oct 2025: {data.allBookings?.length || 0}</div>
      <div>Dorm bookings: {data.dormBookings?.length || 0}</div>
      {data.dormBookings?.map((b: any) => (
        <div key={b.id} className="mt-2 p-2 bg-black/30 rounded">
          <div>Accommodation: {b.accommodations?.title}</div>
          <div>Dates: {b.check_in} to {b.check_out}</div>
          <div>accommodation_id: {b.accommodation_id}</div>
          <div>item_id: {b.accommodation_item_id || 'null'}</div>
        </div>
      ))}
      {data.error && <div className="text-red-300 mt-2">Error: {JSON.stringify(data.error)}</div>}
    </div>
  );
}