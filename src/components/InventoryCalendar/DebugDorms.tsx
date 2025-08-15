import React from 'react';
import { supabase } from '../../lib/supabase';

export function DebugDorms() {
  const [debugInfo, setDebugInfo] = React.useState<any>(null);
  
  React.useEffect(() => {
    async function fetchDebugInfo() {
      // Get dorm bookings
      const { data: dormBookings } = await supabase
        .from('bookings')
        .select('*, accommodations!inner(title)')
        .in('accommodation_id', ['d30c5cf7-f033-449a-8cec-176b754db7ee', '25c2a846-926d-4ac8-9cbd-f03309883e22'])
        .eq('status', 'confirmed');
      
      // Get dorm items
      const { data: dormItems } = await supabase
        .from('accommodation_items')
        .select('*')
        .in('type', ['D3', 'D6']);
      
      setDebugInfo({ dormBookings, dormItems });
    }
    
    fetchDebugInfo();
  }, []);
  
  if (!debugInfo) return null;
  
  return (
    <div className="fixed bottom-20 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md max-h-96 overflow-auto">
      <h3 className="font-bold mb-2">Dorm Debug Info</h3>
      <div className="mb-2">
        <strong>Dorm Bookings ({debugInfo.dormBookings?.length || 0}):</strong>
        {debugInfo.dormBookings?.map((b: any) => (
          <div key={b.id} className="ml-2 mt-1">
            {b.accommodations?.title} | {b.check_in} to {b.check_out} | item_id: {b.accommodation_item_id || 'null'}
          </div>
        ))}
      </div>
      <div className="mb-2">
        <strong>Dorm Items ({debugInfo.dormItems?.length || 0}):</strong>
        {debugInfo.dormItems?.map((item: any) => (
          <div key={item.id} className="ml-2 mt-1">
            {item.type}-{item.item_id} | size: {item.size} | id: {item.id}
          </div>
        ))}
      </div>
    </div>
  );
}