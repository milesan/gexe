import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';
import { format } from 'date-fns'; // Import format for date input default value

interface Accommodation {
  id: string;
  title: string;
  base_price: number; // Changed from price_per_night
}

interface AddBookingModalProps {
  onClose: () => void;
  onSave: () => void;
}

export function AddBookingModal({ onClose, onSave }: AddBookingModalProps) {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [selectedAccommodationId, setSelectedAccommodationId] = useState<string>('');
  const [checkIn, setCheckIn] = useState<string>(format(new Date(), 'yyyy-MM-dd')); // Default to today
  const [checkOut, setCheckOut] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [totalPrice, setTotalPrice] = useState<number | string>(''); // Use string for input flexibility
  const [status, setStatus] = useState<'confirmed' | 'pending' | 'blocked'>('confirmed');
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number | string>(''); // Use string for input flexibility
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingAccommodations, setIsFetchingAccommodations] = useState<boolean>(true);

  useEffect(() => {
    const fetchAccommodations = async () => {
      console.log("AddBookingModal: Fetching accommodations...");
      setIsFetchingAccommodations(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('accommodations')
          .select('id, title, base_price')
          .order('title');

        if (error) {
          console.error("AddBookingModal: Error fetching accommodations:", error);
          throw error;
        }
        
        console.log("AddBookingModal: Accommodations fetched successfully:", data);
        setAccommodations(data || []);
        if (data && data.length > 0) {
          // Don't automatically select the first one, force user selection
          // setSelectedAccommodationId(data[0].id); 
        }
      } catch (err) {
        console.error("AddBookingModal: Failed to load accommodations", err);
        setError(err instanceof Error ? err.message : 'Failed to fetch accommodations.');
      } finally {
        setIsFetchingAccommodations(false);
      }
    };

    fetchAccommodations();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    console.log("AddBookingModal: Initiating booking submission...");

    // Basic Validation
    if (!selectedAccommodationId || !checkIn || !checkOut) {
      setError('Accommodation, Check-in, and Check-out dates are required.');
      setIsLoading(false);
      console.warn("AddBookingModal: Submission failed - missing required fields.");
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
        setError('Check-out date must be after Check-in date.');
        setIsLoading(false);
        console.warn("AddBookingModal: Submission failed - invalid date range.");
        return;
    }

    let userId: string | null = null;
    if (guestEmail) {
      console.log(`AddBookingModal: Guest email provided (${guestEmail}). Looking up user ID...`);
      // IMPORTANT: This requires an RPC function or equivalent to lookup user by email securely.
      // Supabase doesn't allow direct querying of auth.users from the client by default.
      // Let's assume you have an RPC function `get_user_id_by_email`
      try {
        const { data: userData, error: userError } = await supabase.rpc('get_user_id_by_email', { user_email: guestEmail });
        if (userError) {
            console.warn(`AddBookingModal: RPC get_user_id_by_email failed for ${guestEmail}:`, userError.message);
            // Decide whether to proceed without user_id or block submission
            // For now, we'll proceed without linking if lookup fails but email was provided.
        } else if (userData) {
            userId = userData;
            console.log(`AddBookingModal: Found user ID for ${guestEmail}: ${userId}`);
        } else {
            console.log(`AddBookingModal: No user found for email ${guestEmail}. Proceeding without user_id link.`);
        }
      } catch (rpcError) {
          console.error("AddBookingModal: Error calling RPC get_user_id_by_email:", rpcError);
          // Handle error appropriately, maybe notify user? For now, log and proceed without user_id.
      }
    } else {
      console.log("AddBookingModal: No guest email provided.");
    }

    const bookingData = {
      accommodation_id: selectedAccommodationId,
      check_in: checkIn,
      check_out: checkOut,
      user_id: userId, // Will be null if email is empty or user not found
      guest_email: guestEmail || null, // Store the provided email (requires DB schema change)
      total_price: totalPrice === '' ? 0 : Number(totalPrice), // Default to 0 if empty
      status: status,
      applied_discount_code: appliedDiscountCode || null,
      discount_amount: discountAmount === '' ? 0 : Number(discountAmount), // Default to 0 if empty
      // payment_intent_id will be null
      confirmation_email_sent: false, // Default for manual entries
    };

    console.log("AddBookingModal: Attempting to insert booking data:", bookingData);

    try {
      const { error: insertError } = await supabase
        .from('bookings')
        .insert([bookingData]);

      if (insertError) {
        console.error("AddBookingModal: Error inserting booking:", insertError);
        throw insertError;
      }

      console.log("AddBookingModal: Booking inserted successfully.");
      onSave(); // Trigger refresh in parent
      onClose(); // Close modal
    } catch (err) {
      console.error("AddBookingModal: Failed to save booking", err);
      setError(err instanceof Error ? `Failed to save booking: ${err.message}` : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 flex justify-center items-center p-4"
      onClick={onClose} // Close on overlay click
    >
      <div 
        className="bg-[var(--color-bg-main)] rounded-sm border border-[var(--color-border)] shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-display font-light text-[var(--color-text-primary)] mb-6">Add Manual Booking / Block</h2>

        {isFetchingAccommodations && <div className="text-center text-[var(--color-text-secondary)]">Loading accommodations...</div>}
        
        {!isFetchingAccommodations && accommodations.length === 0 && !error && (
             <div className="text-center text-red-500">No accommodations found. Cannot add booking.</div>
        )}
        
        {!isFetchingAccommodations && accommodations.length > 0 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Accommodation Selection */}
            <div>
              <label htmlFor="accommodation" className="block text-sm font-mono text-[var(--color-text-secondary)] mb-1">Accommodation *</label>
              <select
                id="accommodation"
                value={selectedAccommodationId}
                onChange={e => setSelectedAccommodationId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="" disabled>Select Accommodation</option>
                {accommodations.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.title}</option>
                ))}
              </select>
            </div>

            {/* Date Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="checkIn" className="block text-sm font-mono text-[var(--color-text-secondary)] mb-1">Check-in Date *</label>
                <input
                  type="date"
                  id="checkIn"
                  value={checkIn}
                  onChange={e => setCheckIn(e.target.value)}
                  required
                  min={format(new Date(), 'yyyy-MM-dd')} // Prevent past dates
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="checkOut" className="block text-sm font-mono text-[var(--color-text-secondary)] mb-1">Check-out Date *</label>
                <input
                  type="date"
                  id="checkOut"
                  value={checkOut}
                  onChange={e => setCheckOut(e.target.value)}
                  required
                  min={checkIn || format(new Date(), 'yyyy-MM-dd')} // Min check-out is check-in date
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Guest Email */}
            <div>
              <label htmlFor="guestEmail" className="block text-sm font-mono text-[var(--color-text-secondary)] mb-1">Guest Email (Optional - leave blank for block)</label>
              <input
                type="email"
                id="guestEmail"
                value={guestEmail}
                onChange={e => setGuestEmail(e.target.value)}
                placeholder="guest@example.com"
                className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">If provided, attempts to link to an existing user account.</p>
              {/* <p className="text-xs font-bold text-amber-500 mt-1">Requires `guest_email` text column in `bookings` table and `get_user_id_by_email` Supabase RPC function.</p> */}
            </div>
            
            {/* Price and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="totalPrice" className="block text-sm font-mono text-[var(--color-text-secondary)] mb-1">Total Price (€)</label>
                <input
                  type="number"
                  id="totalPrice"
                  value={totalPrice}
                  onChange={e => setTotalPrice(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-mono text-[var(--color-text-secondary)] mb-1">Status *</label>
                <select
                  id="status"
                  value={status}
                  onChange={e => setStatus(e.target.value as 'confirmed' | 'pending' | 'blocked')}
                  required
                  className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
            
            {/* Discount Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                <label htmlFor="appliedDiscountCode" className="block text-sm font-mono text-[var(--color-text-secondary)] mb-1">Discount Code (Optional)</label>
                <input
                  type="text"
                  id="appliedDiscountCode"
                  value={appliedDiscountCode}
                  onChange={e => setAppliedDiscountCode(e.target.value)}
                  placeholder="e.g., SUMMER24"
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="discountAmount" className="block text-sm font-mono text-[var(--color-text-secondary)] mb-1">Discount Amount (€)</label>
                <input
                  type="number"
                  id="discountAmount"
                  value={discountAmount}
                  onChange={e => setDiscountAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && <p className="text-red-500 text-sm font-mono">{error}</p>}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-50 transition font-mono text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || isFetchingAccommodations || accommodations.length === 0}
                className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-70 transition font-mono text-sm flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  'Save Entry'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 