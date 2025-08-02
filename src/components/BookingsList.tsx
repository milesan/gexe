import React, { useState } from 'react';
import { format } from 'date-fns-tz';
import { supabase } from '../lib/supabase';
import { parseISO } from 'date-fns';
import { Edit, Trash2, PlusCircle, Receipt, Mail, MailCheck, ChevronUp, ChevronDown, Coins } from 'lucide-react';
import { EditBookingModal } from './EditBookingModal';
import { AddBookingModal } from './AddBookingModal';
import { PriceBreakdownModal } from './PriceBreakdownModal';
import { motion } from 'framer-motion';
import { ApplicationDetails } from './admin/ApplicationDetails';

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
  user_name?: string | null;
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
  reminder_email_sent?: boolean | null;
  payments?: Payment[];
}

// Define a simple User type for the map callbacks
interface SimpleUser {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

type SortField = 'check_in' | 'created_at' | 'total_price';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
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
  // Add state for copied email feedback
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);
  // Add state for sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'created_at', direction: 'desc' });
  // Add state for application details
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  // Add state for credit refund
  const [refundAmount, setRefundAmount] = useState<string>('');

  React.useEffect(() => {
    loadBookings();
    loadQuestions();

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

  // Reload bookings when sort changes
  React.useEffect(() => {
    loadBookings();
  }, [sortConfig]);

  async function loadQuestions() {
    try {
      const { data, error } = await supabase
        .from('application_questions')
        .select('*')
        .order('order_number');

      if (error) throw error;
      setQuestions(data || []);
    } catch (err) {
      console.error('Error loading questions:', err);
    }
  }

  async function handleGuestNameClick(booking: Booking) {
    if (!booking.user_id) {
      console.log('No user_id for guest booking');
      return;
    }

    try {
      // Fetch the application for this user
      const { data, error } = await supabase
        .from('application_details')
        .select('*')
        .eq('user_id', booking.user_id)
        .single();

      if (error) {
        console.error('Error fetching application:', error);
        return;
      }

      if (data) {
        setSelectedApplication(data);
      }
    } catch (err) {
      console.error('Error loading application details:', err);
    }
  }

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
        .order(sortConfig.field, { ascending: sortConfig.direction === 'asc' });

      if (bookingsError) {
        throw bookingsError;
      }
      
      // Get all user IDs from the bookings
      const userIds = [...new Set(bookingsData?.map(booking => booking.user_id).filter(Boolean) || [])];
      
      // Fetch all user details using the enhanced function
      let allUserData: SimpleUser[] = [];
      if (userIds.length > 0) {
        try {
          const { data: userData, error: userError } = await supabase
            .rpc('get_profiles_by_ids', { 
              user_ids: userIds 
            });

          if (userError) {
            console.error('[BookingsList] userError from get_profiles_by_ids:', userError);
            // Create basic placeholders for missing user data
            allUserData = userIds.map(id => ({
              id,
              email: `${id.substring(0, 8)}@placeholder.com`,
              first_name: 'Guest',
              last_name: `#${id.substring(0, 6)}`
            }));
          } else {
            allUserData = userData || [];
            
            // Add placeholders for any missing users
            if (allUserData.length < userIds.length) {
              const foundIds = new Set(allUserData.map((user: SimpleUser) => user.id));
              const missingIds = userIds.filter(id => !foundIds.has(id));
              
              if (missingIds.length > 0) {
                console.log('[BookingsList] Creating placeholders for missing users:', missingIds);
                
                missingIds.forEach(id => {
                  allUserData.push({
                    id,
                    email: `${id.substring(0, 8)}@placeholder.com`,
                    first_name: 'Guest',
                    last_name: `#${id.substring(0, 6)}`
                  });
                });
              }
            }
          }
        } catch (err) {
          console.error('[BookingsList] Unexpected error fetching user data:', err);
          // Create basic placeholders for all users on error
          allUserData = userIds.map(id => ({
            id,
            email: `${id.substring(0, 8)}@placeholder.com`,
            first_name: 'Guest',
            last_name: `#${id.substring(0, 6)}`
          }));
        }
      }

      // Create maps for user emails and names
      const userEmailMap = Object.fromEntries(
        allUserData.map((user: SimpleUser) => [user.id, user.email || `${user.id.substring(0, 8)}@placeholder.com`])
      );

      const userNameMap = Object.fromEntries(
        allUserData.map((user: SimpleUser) => [
          user.id, 
          `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown'
        ])
      );
      
      const processedBookings = (bookingsData || []).map(booking => {
        let userEmail = booking.user_email || 'No email provided';
        let userName = '';

        if (booking.user_id) {
          // This is a registered user
          if (userEmailMap[booking.user_id]) {
            userEmail = userEmailMap[booking.user_id];
            userName = userNameMap[booking.user_id] || 'Unknown';
          } else {
            // Registered user, but no profile data found
            userEmail = `${String(booking.user_id).substring(0, 8)}@unknown.user`;
            userName = 'Unknown';
          }
        } else if (booking.guest_email) {
          // This is a guest user
          userEmail = booking.guest_email;
          userName = '[added manually]';
        }

        return {
          ...booking,
          accommodation_title: booking.accommodations?.title || 'N/A',
          user_email: userEmail,
          user_name: userName,
          payments: booking.payments || []
        };
      });

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
    // Set default refund amount to credits used
    if (booking.credits_used && booking.credits_used > 0) {
      setRefundAmount(booking.credits_used.toString());
    } else {
      setRefundAmount('0');
    }
  };

  const closeCancelConfirmModal = () => {
    setBookingToCancel(null);
    setShowCancelConfirmModal(false);
    setRefundAmount('');
  };

  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return;

    setLoading(true);

    try {
      const refundAmountNum = parseFloat(refundAmount) || 0;
      const creditsUsed = bookingToCancel.credits_used || 0;
      
      // Build the update object
      const updateData: any = { status: 'cancelled' };
      
      // If admin specified a refund amount different from credits used, set it
      if (bookingToCancel.user_id && creditsUsed > 0 && refundAmountNum !== creditsUsed) {
        updateData.admin_refund_amount = refundAmountNum;
      }
      
      // Cancel the booking (trigger will use admin_refund_amount if set)
      const { error: deleteError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingToCancel.id);

      if (deleteError) throw deleteError;

      await loadBookings();
      setError(null);
      closeCancelConfirmModal();
      
      if (creditsUsed > 0) {
        if (refundAmountNum !== creditsUsed) {
          alert(`Booking cancelled. Refunded €${refundAmountNum} of €${creditsUsed} credits used.`);
        } else {
          alert(`Booking cancelled and €${creditsUsed} in credits refunded.`);
        }
      } else {
        alert('Booking cancelled successfully.');
      }

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

  const handleSort = (field: SortField) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        // Same field, toggle direction
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      } else {
        // New field, default to descending for dates and price
        const defaultDirection = field === 'total_price' ? 'asc' : 'desc';
        return { field, direction: defaultDirection };
      }
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return null;
    }
    return sortConfig.direction === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };


  const handleToggleReminder = async (booking: Booking) => {
    try {
      const newReminderStatus = !booking.reminder_email_sent;
      
      const { error } = await supabase
        .from('bookings')
        .update({ reminder_email_sent: newReminderStatus })
        .eq('id', booking.id);

      if (error) {
        console.error('Error updating reminder status:', error);
        return;
      }

      // Update the local state
      setBookings(prev => prev.map(b => 
        b.id === booking.id 
          ? { ...b, reminder_email_sent: newReminderStatus }
          : b
      ));
    } catch (err) {
      console.error('Error toggling reminder status:', err);
    }
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
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                onClick={() => handleSort('check_in')}
              >
                <div className="flex items-center gap-1">
                  Check-in
                  {getSortIcon('check_in')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Check-out
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Reminder
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                onClick={() => handleSort('total_price')}
              >
                <div className="flex items-center gap-1">
                  Price
                  {getSortIcon('total_price')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                onClick={() => handleSort('created_at')}
              >
                <div className="flex items-center gap-1">
                  Created At
                  {getSortIcon('created_at')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-[var(--color-bg-surface)] divide-y divide-[var(--color-border)]">
            {bookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-[var(--color-bg-surface-hover)] transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    {booking.accommodation_title}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-[var(--color-text-primary)]">
                    {booking.user_name && booking.user_name !== 'Unknown' ? (
                      <div>
                        <button
                          onClick={() => handleGuestNameClick(booking)}
                          className="font-medium hover:text-[var(--color-accent-primary)] hover:underline transition-colors cursor-pointer text-left"
                          disabled={!booking.user_id || booking.user_name === '[added manually]'}
                        >
                          {booking.user_name}
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(booking.user_email || '');
                            setCopiedEmailId(booking.id);
                            setTimeout(() => setCopiedEmailId(null), 1000);
                            console.log('[BookingsList] Copied email to clipboard:', booking.user_email);
                          }}
                          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition-colors cursor-pointer block"
                          title="Click to copy email address"
                        >
                          {copiedEmailId === booking.id ? 'Copied!' : booking.user_email}
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(booking.user_email || '');
                          setCopiedEmailId(booking.id);
                          setTimeout(() => setCopiedEmailId(null), 1000);
                          console.log('[BookingsList] Copied email to clipboard:', booking.user_email);
                        }}
                        className="text-sm text-[var(--color-text-primary)] hover:text-[var(--color-accent-primary)] transition-colors cursor-pointer"
                        title="Click to copy email address"
                      >
                        {copiedEmailId === booking.id ? 'Copied!' : booking.user_email}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                  {format(parseISO(booking.check_in), 'PP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                  {format(parseISO(booking.check_out), 'PP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleReminder(booking)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-colors hover:bg-[var(--color-bg-surface-hover)] ${
                      booking.reminder_email_sent 
                        ? 'text-green-600 hover:text-green-700' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title={booking.reminder_email_sent ? 'Click to mark as not sent' : 'Click to mark as sent'}
                  >
                    {booking.reminder_email_sent ? (
                      <>
                        <MailCheck className="w-4 h-4" />
                        <span className="text-xs font-medium">Sent</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span className="text-xs">Pending</span>
                      </>
                    )}
                  </button>
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
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-sm bg-slate-600 text-white hover:bg-red-600 transition-all"
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

      {/* Application Details Modal */}
      {selectedApplication && (
        <ApplicationDetails 
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          questions={questions}
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
                <strong className="text-[var(--color-text-primary)]">Total Price:</strong> €{Number(bookingToCancel.total_price).toFixed(2)}
                {bookingToCancel.credits_used > 0 && (
                  <span className="text-emerald-400"> (€{Number(bookingToCancel.credits_used).toFixed(2)} in credits)</span>
                )}
              </p>
            </div>
            {bookingToCancel.credits_used > 0 && bookingToCancel.user_id && (
              <div className="mb-4 p-4 bg-emerald-900/20 border border-emerald-700/50 rounded-sm">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Credit Refund Amount (€)
                </label>
                <input
                  type="number"
                  min="0"
                  max={bookingToCancel.credits_used}
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={`Max: €${Number(bookingToCancel.credits_used).toFixed(2)}`}
                />
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  This booking used €{Number(bookingToCancel.credits_used).toFixed(2)} in credits. You can refund any amount up to this value.
                </p>
              </div>
            )}
            <p className="text-[var(--color-text-secondary)] mb-4 font-mono">
              <strong className="text-[var(--color-text-primary)]">Note:</strong> This will cancel the booking{bookingToCancel.credits_used && bookingToCancel.credits_used > 0 && refundAmount && parseFloat(refundAmount) > 0 ? ` and refund €${parseFloat(refundAmount).toFixed(2)} in credits` : ''}. To permanently delete the booking record, you'll need to do it via Supabase.
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