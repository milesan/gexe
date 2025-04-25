import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { X } from 'lucide-react'; // Icon for close button

// Define the structure of an Accommodation (just what we need for the dropdown)
interface AccommodationOption {
  id: string;
  title: string;
}

// Define the structure of the Booking data passed to the modal
interface Booking {
  id: string;
  accommodation_id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  // Add other fields if needed, but these are the editable ones + id
}

// Props for the modal component
interface EditBookingModalProps {
  booking: Booking;
  onClose: () => void;
  onSave: () => void; // Function to trigger refresh in parent
}

export function EditBookingModal({ booking, onClose, onSave }: EditBookingModalProps) {
  const [formData, setFormData] = useState({
    accommodation_id: booking.accommodation_id,
    check_in: format(parseISO(booking.check_in), 'yyyy-MM-dd'), // Format for input type="date"
    check_out: format(parseISO(booking.check_out), 'yyyy-MM-dd'), // Format for input type="date"
    total_price: booking.total_price,
  });
  const [accommodations, setAccommodations] = useState<AccommodationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAccommodations, setIsFetchingAccommodations] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch accommodations when the modal mounts
  useEffect(() => {
    const fetchAccommodations = async () => {
      setIsFetchingAccommodations(true);
      setError(null);
      console.log('Fetching accommodations for dropdown...');
      try {
        const { data, error } = await supabase
          .from('accommodations')
          .select('id, title')
          .order('title', { ascending: true });

        if (error) {
          console.error('Error fetching accommodations:', error);
          throw error;
        }
        
        console.log('Fetched accommodations:', data?.length || 0);
        setAccommodations(data || []);
      } catch (err) {
        console.error('Failed to load accommodations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load accommodation options.');
      } finally {
        setIsFetchingAccommodations(false);
      }
    };

    fetchAccommodations();
  }, []); // Empty dependency array means this runs once on mount

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'total_price' ? parseFloat(value) || 0 : value, // Ensure price is a number
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    setIsLoading(true);
    setError(null);
    console.log('Saving updated booking data:', formData);

    try {
      // Implement the actual Supabase update call
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          accommodation_id: formData.accommodation_id,
          check_in: formData.check_in, // Already in YYYY-MM-DD format from input
          check_out: formData.check_out, // Already in YYYY-MM-DD format from input
          total_price: formData.total_price,
          // Consider adding updated_at: new Date().toISOString(), if you don't have db triggers
        })
        .eq('id', booking.id);

      if (updateError) {
          console.error('Supabase update error:', updateError);
          throw updateError;
      }

      console.log('Booking update successful in Supabase for ID:', booking.id);
      // Remove simulation
      // await new Promise(resolve => setTimeout(resolve, 500)); 

      onSave(); // Trigger refresh in parent (optional, subscription might handle it)
      onClose(); // Close the modal

    } catch (err) {
      console.error('Failed to update booking:', err);
      setError(err instanceof Error ? `Failed to save: ${err.message}` : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-xl p-6 w-full max-w-md relative border border-[var(--color-border)]">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-semibold font-display text-[var(--color-text-primary)] mb-4">Edit Booking</h2>

        {isFetchingAccommodations ? (
          <div className="flex justify-center items-center h-32">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : error && !isFetchingAccommodations ? ( // Show initial fetch error prominently
          <div className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{error}</div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="mb-4">
              <label htmlFor="accommodation_id" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1 font-mono">Accommodation</label>
              <select
                id="accommodation_id"
                name="accommodation_id"
                value={formData.accommodation_id}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-[var(--color-bg-main)] border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-[var(--color-text-primary)] font-mono"
                disabled={isLoading}
              >
                <option value="" disabled>Select Accommodation</option>
                {accommodations.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.title}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="check_in" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1 font-mono">Check-in</label>
                <input
                  type="date"
                  id="check_in"
                  name="check_in"
                  value={formData.check_in}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-[var(--color-bg-main)] border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-[var(--color-text-primary)] font-mono"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="check_out" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1 font-mono">Check-out</label>
                <input
                  type="date"
                  id="check_out"
                  name="check_out"
                  value={formData.check_out}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-[var(--color-bg-main)] border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-[var(--color-text-primary)] font-mono"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="total_price" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1 font-mono">Total Price (€)</label>
              <input
                type="number"
                id="total_price"
                name="total_price"
                value={formData.total_price}
                onChange={handleInputChange}
                required
                step="0.01" // Allow cents
                min="0"
                className="w-full px-3 py-2 bg-[var(--color-bg-main)] border border-[var(--color-border)] rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-[var(--color-text-primary)] font-mono"
                disabled={isLoading}
              />
            </div>

            {error && !isFetchingAccommodations && ( // Show save error here
              <div className="text-red-500 text-sm mb-4">{error}</div>
            )}

            <div className="flex justify-end gap-3">
              <button 
                type="button" 
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 border border-[var(--color-border)] rounded-md shadow-sm text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isLoading || isFetchingAccommodations}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 