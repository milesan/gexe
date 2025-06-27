import React, { useState } from 'react';
import { format } from 'date-fns-tz';
import { supabase } from '../lib/supabase';
import { parseISO } from 'date-fns';
import { Edit, Trash2, PlusCircle, Receipt } from 'lucide-react';
import { EditBookingModal } from './EditBookingModal';
import { AddBookingModal } from './AddBookingModal';
import { PriceBreakdownModal } from './PriceBreakdownModal';

interface Booking {
  id: string;
  accommodation_id: string;
  user_id: string | null;
  check_in: string;
  check_out: string;
  total_price: number;
  status: string;
  created_at: string;
  accommodation_title: string;
  user_email: string | null;
  guest_email?: string | null;
  applied_discount_code: string | null;
  accommodations?: { title: string } | null;
  accommodation_price?: number | null;
  accommodation_price_paid?: number | null; // NEW: Actual accommodation amount paid
  food_contribution?: number | null;
  seasonal_adjustment?: number | null;
  duration_discount_percent?: number | null;
  discount_amount?: number | null;
  credits_used?: number | null;
  discount_code_percent?: number | null;
}

export function BookingsList() {
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [breakdownModalBooking, setBreakdownModalBooking] = useState<Booking | null>(null);

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
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      console.log('Current user:', user.id);

      console.log('Fetching bookings with accommodation titles...');
      const { data: bookingsData, error: bookingsError, count } = await supabase
        .from('bookings_with_emails')
        .select(`
          *,
          applied_discount_code,
          accommodation_price,
          accommodation_price_paid,
          food_contribution,
          seasonal_adjustment,
          duration_discount_percent,
          discount_amount,
          credits_used,
          discount_code_percent,
          accommodations ( title )
        `, { count: 'exact' })
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Error fetching bookings with details:', bookingsError);
        throw bookingsError;
      }
      
      console.log(`Retrieved ${bookingsData?.length || 0} active bookings out of ${count || 0} total (excluding cancelled)`);
      
      const processedBookings = (bookingsData || []).map(booking => {
        return {
          ...booking,
          accommodation_title: booking.accommodations?.title || 'N/A',
        };
      });

      console.log('Setting bookings state with processed data:', processedBookings.length, 'bookings');
      setBookings(processedBookings);
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  const handleEditClick = (booking: Booking) => {
    console.log('Editing booking:', booking);
    setEditingBooking(booking);
  };

  const handleDeleteClick = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This cannot be undone.')) {
      return;
    }

    console.log('Attempting to cancel booking:', bookingId);
    setLoading(true);

    try {
      const { error: deleteError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (deleteError) {
        console.error('Error cancelling booking:', deleteError);
        throw deleteError;
      }

      console.log('Booking cancelled successfully:', bookingId);
      await loadBookings();
      setError(null);

    } catch (err) {
      console.error('Failed to cancel booking:', err);
      setError(err instanceof Error ? `Failed to cancel booking: ${err.message}` : 'An unknown error occurred during cancellation.');
      setLoading(false);
    }
  };

  // Handler to close the edit modal
  const handleCloseEditModal = () => {
    setEditingBooking(null);
  };
  
  // Handler to close the add modal
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  // Handler potentially needed if subscription doesn't auto-refresh reliably
  const handleSaveChanges = async () => {
    console.log('Edit modal saved, reloading bookings list...');
    // We might not need this explicit reload if the subscription works well,
    // but it doesn't hurt to ensure freshness after an edit.
    await loadBookings(); 
  };

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
    <div className="p-4">
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-mono text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Add Manual Entry
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-border)]">
          <thead className="bg-[var(--color-bg-surface)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Accommodation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Guest
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Check-in
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Check-out
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Discount Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Created At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-[var(--color-bg-surface)] divide-y divide-[var(--color-border)]">
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    {booking.accommodation_title}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-[var(--color-text-primary)]">
                    {booking.guest_email || booking.user_email || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                  {format(parseISO(booking.check_in), 'PP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                  {format(parseISO(booking.check_out), 'PP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-primary)]">
                  <div className="flex items-center gap-2">
                    <span>
                      €{(() => {
                        const creditsUsed = booking.credits_used || 0;
                        const finalAmount = creditsUsed > 0 ? Number(booking.total_price) - creditsUsed : Number(booking.total_price);
                        return finalAmount % 1 === 0 ? finalAmount.toFixed(0) : finalAmount.toFixed(2);
                      })()}
                    </span>
                    {/* Show credits used indicator if credits were used */}
                    {booking.credits_used !== null && booking.credits_used !== undefined && booking.credits_used > 0 && (
                      <span className="text-xs text-blue-600 font-mono">
                        (-{booking.credits_used} credits)
                      </span>
                    )}
                    {/* Show a compact discount indicator if discount exists */}
                    {booking.discount_amount !== null && booking.discount_amount !== undefined && booking.discount_amount > 0 && (
                      <span className="text-xs text-emerald-600 font-mono">
                        (-€{booking.discount_amount.toFixed(0)})
                      </span>
                    )}
                    {/* Show breakdown button - always available for admin */}
                    <button
                      onClick={() => setBreakdownModalBooking(booking)}
                      className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded hover:bg-[var(--color-bg-surface)]"
                      title="View price breakdown"
                    >
                      <Receipt className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-primary)]">
                  {booking.applied_discount_code ? (
                    <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">
                      {booking.applied_discount_code}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-secondary)]">
                      {new Date(booking.created_at) < new Date('2025-06-02') ? 'Unknown' : 'None'}
                    </span>
                  )}
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                  {format(new Date(booking.created_at), 'PPp', { timeZone: 'UTC' })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => handleEditClick(booking)} 
                    className="text-indigo-600 hover:text-indigo-900 mr-3 transition-colors duration-150"
                    aria-label={`Edit booking ${booking.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(booking.id)} 
                    className="text-red-600 hover:text-red-900 transition-colors duration-150"
                    aria-label={`Cancel booking ${booking.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Render the edit modal conditionally */}
      {editingBooking && (
        <EditBookingModal 
          booking={editingBooking} 
          onClose={handleCloseEditModal}
          onSave={handleSaveChanges}
        />
      )}

      {/* Render the add modal conditionally */}
      {isAddModalOpen && (
        <AddBookingModal 
          onClose={handleCloseAddModal} 
          onSave={handleSaveChanges} // Reuse save handler for refresh logic
        />
      )}

      {/* Render the price breakdown modal */}
      {breakdownModalBooking && (
        <PriceBreakdownModal
          isOpen={!!breakdownModalBooking}
          onClose={() => setBreakdownModalBooking(null)}
          booking={breakdownModalBooking}
        />
      )}
    </div>
  );
}