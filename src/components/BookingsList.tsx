import React, { useState } from 'react';
import { format } from 'date-fns-tz';
import { supabase } from '../lib/supabase';
import { parseISO } from 'date-fns';
import { Edit, Trash2, PlusCircle, Receipt } from 'lucide-react';
import { EditBookingModal } from './EditBookingModal';
import { AddBookingModal } from './AddBookingModal';
import { PriceBreakdownModal } from './PriceBreakdownModal';
import { motion } from 'framer-motion';

interface Payment {
  id: string;
  booking_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  amount_paid: number;
  breakdown_json: any | null;
  discount_code: string | null;
  payment_type: string;
  stripe_payment_id: string | null;
  created_at: string;
  updated_at: string;
  status: string;
}

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
  accommodation_price_paid?: number | null;
  food_contribution?: number | null;
  seasonal_adjustment?: number | null;
  seasonal_discount_percent?: number | null;
  duration_discount_percent?: number | null;
  discount_amount?: number | null;
  credits_used?: number | null;
  discount_code_percent?: number | null;
  discount_code_applies_to?: string | null;
  accommodation_price_after_seasonal_duration?: number | null;
  subtotal_after_discount_code?: number | null;
  payments?: Payment[];
}

export function BookingsList() {
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [breakdownModalBooking, setBreakdownModalBooking] = useState<Booking | null>(null);
  // Add new state for cancellation confirmation modal
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);

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

      // Single optimized query to get bookings with payments
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings_with_emails')
        .select(`
          *,
          applied_discount_code,
          accommodation_price,
          accommodation_price_paid,
          food_contribution,
          seasonal_adjustment,
          seasonal_discount_percent,
          duration_discount_percent,
          discount_amount,
          credits_used,
          discount_code_percent,
          discount_code_applies_to,
          accommodation_price_after_seasonal_duration,
          subtotal_after_discount_code,
          accommodations ( title ),
          payments (
            id,
            booking_id,
            user_id,
            start_date,
            end_date,
            amount_paid,
            breakdown_json,
            discount_code,
            payment_type,
            stripe_payment_id,
            created_at,
            updated_at,
            status
          )
        `)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (bookingsError) {
        throw bookingsError;
      }
      
      const processedBookings = (bookingsData || []).map(booking => ({
        ...booking,
        accommodation_title: booking.accommodations?.title || 'N/A',
        payments: booking.payments || []
      }));

      setBookings(processedBookings);
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  const handleEditClick = (booking: Booking) => {
    setEditingBooking(booking);
  };

  const openCancelConfirmModal = (booking: Booking) => {
    setBookingToCancel(booking);
    setShowCancelConfirmModal(true);
  };

  const closeCancelConfirmModal = () => {
    setBookingToCancel(null);
    setShowCancelConfirmModal(false);
  };

  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return;

    setLoading(true);

    try {
      const { error: deleteError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingToCancel.id);

      if (deleteError) {
        throw deleteError;
      }

      await loadBookings();
      setError(null);
      closeCancelConfirmModal();

    } catch (err) {
      console.error('Failed to cancel booking:', err);
      setError(err instanceof Error ? `Failed to cancel booking: ${err.message}` : 'An unknown error occurred during cancellation.');
      setLoading(false);
    }
  };

  const handleDeleteClick = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      openCancelConfirmModal(booking);
    }
  };

  const handleCloseEditModal = () => {
    setEditingBooking(null);
  };
  
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleSaveChanges = async () => {
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
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-emerald-800 text-white hover:bg-emerald-700 transition-colors font-mono text-sm"
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
      
      {editingBooking && (
        <EditBookingModal 
          booking={editingBooking} 
          onClose={handleCloseEditModal}
          onSave={handleSaveChanges}
        />
      )}

      {isAddModalOpen && (
        <AddBookingModal 
          onClose={handleCloseAddModal} 
          onSave={handleSaveChanges}
        />
      )}

      {breakdownModalBooking && (
        <PriceBreakdownModal
          isOpen={!!breakdownModalBooking}
          onClose={() => setBreakdownModalBooking(null)}
          booking={breakdownModalBooking}
        />
      )}

      {/* Cancellation Confirmation Modal */}
      {showCancelConfirmModal && bookingToCancel && (
        <div 
          className="fixed inset-0 bg-overlay backdrop-blur-sm flex justify-center items-center z-[100] p-4"
          onClick={closeCancelConfirmModal}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-[var(--color-bg-surface)] p-6 md:p-8 rounded-sm shadow-2xl w-full max-w-md border border-[var(--color-border)] relative z-[101]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4 font-mono">Confirm Booking Cancellation</h2>
            <p className="text-[var(--color-text-secondary)] mb-1 font-mono">
              Are you sure you want to cancel the booking for{' '}
              <strong className="text-[var(--color-text-primary)]">
                {bookingToCancel.guest_email || bookingToCancel.user_email || 'Unknown Guest'}
              </strong>?
            </p>
            <div className="mb-4">
              <p className="text-sm text-[var(--color-text-secondary)] font-mono mb-2">
                <strong className="text-[var(--color-text-primary)]">Accommodation:</strong> {bookingToCancel.accommodation_title}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] font-mono mb-2">
                <strong className="text-[var(--color-text-primary)]">Dates:</strong> {format(parseISO(bookingToCancel.check_in), 'PP')} - {format(parseISO(bookingToCancel.check_out), 'PP')}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] font-mono">
                <strong className="text-[var(--color-text-primary)]">Total Price:</strong> €{bookingToCancel.total_price}
                {bookingToCancel.credits_used && bookingToCancel.credits_used > 0 && (
                  <span className="text-emerald-400"> (€{bookingToCancel.credits_used} in credits)</span>
                )}
              </p>
            </div>
            <p className="text-[var(--color-text-secondary)] mb-4 font-mono">
              <strong className="text-[var(--color-text-primary)]">Note:</strong> This will cancel the booking and refund any credits that were used. 
              To permanently delete the booking record, you'll need to do it via Supabase.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeCancelConfirmModal}
                className="px-4 py-2 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={loading}
                className={`px-4 py-2 rounded-sm bg-red-600 text-white hover:bg-red-700 transition-colors font-mono flex items-center justify-center ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Cancel Booking'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}