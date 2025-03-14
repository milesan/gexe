import React from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

interface Booking {
  id: string;
  accommodation_id: string;
  user_id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  status: string;
  created_at: string;
  accommodation_title: string;
  user_email: string;
}

export function BookingsList() {
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadBookings();

    // Subscribe to booking changes
    const bookingsSubscription = supabase
      .channel('bookings_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadBookings();
      })
      .subscribe();

    return () => {
      bookingsSubscription.unsubscribe();
    };
  }, []);

  async function loadBookings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      console.log('Current user:', user.id);
      console.log('User metadata:', user.user_metadata);
      console.log('Is admin:', user.user_metadata?.is_admin);

      // First get the bookings
      console.log('Fetching all bookings...');
      
      // Try a direct query first
      const { data: directBookings, error: directError } = await supabase
        .from('bookings_with_emails')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('Direct query results:', directBookings?.length || 0, 'bookings');
      
      // Then try with count
      const { data: bookingsData, error: bookingsError, count } = await supabase
        .from('bookings_with_emails')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }
      
      console.log(`Retrieved ${bookingsData?.length || 0} bookings out of ${count || 0} total`);
      console.log('Booking IDs:', bookingsData?.map(b => b.id));
      
      // Then fetch the related data
      console.log('Enriching bookings with accommodation details...');
      const enrichedBookings = await Promise.all((bookingsData || []).map(async (booking) => {
        try {
          // Get accommodation details
          const { data: accomData, error: accomError } = await supabase
            .from('accommodations')
            .select('title')
            .eq('id', booking.accommodation_id)
            .single();
            
          if (accomError) {
            console.error(`Error fetching accommodation ${booking.accommodation_id}:`, accomError);
          }

          return {
            ...booking,
            accommodation_title: accomData?.title || 'N/A'
          };
        } catch (enrichError) {
          console.error(`Error enriching booking ${booking.id}:`, enrichError);
          // Return the booking with placeholder data rather than failing the whole process
          return {
            ...booking,
            accommodation_title: 'Error loading'
          };
        }
      }));

      console.log('Setting bookings state with enriched data:', enrichedBookings);
      setBookings(enrichedBookings);
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center">{error}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Accommodation
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Guest
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Check-in
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Check-out
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created At
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {booking.accommodation_title}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {booking.user_email}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {format(new Date(booking.check_in), 'PP')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {format(new Date(booking.check_out), 'PP')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                €{booking.total_price}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  booking.status === 'confirmed' 
                    ? 'bg-green-100 text-green-800'
                    : booking.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {booking.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {format(new Date(booking.created_at), 'PPp')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}