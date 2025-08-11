import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Booking, AccommodationRow } from './types';
import { formatInTimeZone } from 'date-fns-tz';
import { CreateAccommodationItemModal } from './CreateAccommodationItemModal';

interface Props {
  booking: Booking;
  accommodationRows: AccommodationRow[];
  onClose: () => void;
  onReassign: (bookingId: string, newItemId: string) => void;
}

export function ReassignModal({ booking, accommodationRows, onClose, onReassign }: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string>(booking.accommodation_item_id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // For "Staying with somebody", "Your Own Tent", and "Van Parking", show all accommodation items
  // For other types, only show items of the same accommodation type
  const canAssignAnywhere = booking.accommodation_title === 'Staying with somebody' ||
                          booking.accommodation_title === 'Your Own Tent' ||
                          booking.accommodation_title === 'Van Parking';
  
  const availableRows = accommodationRows.filter(row => {
    if (canAssignAnywhere) {
      // Show all accommodation items for flexible accommodation types
      return row.item_id && !row.is_bed; // Exclude dorm beds
    } else {
      // Show only same accommodation type
      return row.accommodation_id === booking.accommodation_id && row.item_id;
    }
  });

  const handleNewItemCreated = async (newItemId: string) => {
    // Close the create modal
    setShowCreateModal(false);
    
    // Set the newly created item as selected
    setSelectedItemId(newItemId);
    
    // Trigger the reassignment
    await handleReassign(newItemId);
  };

  const handleReassign = async (itemIdToAssign?: string) => {
    const itemId = itemIdToAssign || selectedItemId;
    if (itemId === booking.accommodation_item_id) {
      setError('Please select a different accommodation item');
      return;
    }

    console.log('Reassigning booking:', {
      booking_id: booking.id,
      booking_title: booking.accommodation_title,
      from_item: booking.accommodation_item_id,
      to_item: itemId,
      is_staying_with_somebody: booking.accommodation_title === 'Staying with somebody'
    });

    setLoading(true);
    setError(null);

    try {
      if (itemId === 'unassigned') {
        // Remove the accommodation assignment
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ 
            accommodation_item_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', booking.id);

        if (updateError) throw updateError;
      } else {
        // Assign to a specific accommodation item
        const { error: reassignError } = await supabase
          .rpc('assign_accommodation_item_to_booking', {
            p_booking_id: booking.id,
            p_accommodation_item_id: itemId
          });

        if (reassignError) throw reassignError;
      }
      
      // If no error, the reassignment was successful
      onReassign(booking.id, itemId);
      onClose();
    } catch (err) {
      console.error('Error reassigning booking:', err);
      // Parse the error message for user-friendly display
      let errorMessage = 'Failed to reassign booking';
      if (err instanceof Error) {
        if (err.message.includes('already booked')) {
          errorMessage = 'This accommodation is already booked for these dates';
        } else if (err.message.includes('Booking not found')) {
          errorMessage = 'Booking not found';
        } else if (err.message.includes('Accommodation item not found')) {
          errorMessage = 'Selected accommodation not found';
        } else if (err.message.includes('different accommodation type')) {
          errorMessage = 'Cannot reassign to a different accommodation type';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
            Reassign Accommodation
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--color-bg-surface-hover)] rounded"
          >
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            Guest: <span className="font-medium text-[var(--color-text-primary)]">
              {booking.guest_name || booking.guest_email}
            </span>
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            Dates: <span className="font-medium text-[var(--color-text-primary)]">
              {formatInTimeZone(booking.check_in, 'UTC', 'MMM d')} - {formatInTimeZone(booking.check_out, 'UTC', 'MMM d')}
            </span>
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Current: <span className="font-medium text-[var(--color-text-primary)]">
              {booking.item_tag || booking.accommodation_title}
            </span>
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Select new accommodation:
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => {
              if (e.target.value === 'create_new') {
                setShowCreateModal(true);
              } else {
                setSelectedItemId(e.target.value);
              }
            }}
            className="w-full p-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded 
                     text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select...</option>
            <option value="unassigned">⚪ Unassigned</option>
            <option value="create_new" className="text-emerald-500 font-medium">
              ➕ Create New Tag
            </option>
            {canAssignAnywhere ? (
              // Group by accommodation type for flexible assignment types
              Object.entries(
                availableRows.reduce((groups, row) => {
                  const type = row.accommodation_title;
                  if (!groups[type]) groups[type] = [];
                  groups[type].push(row);
                  return groups;
                }, {} as Record<string, typeof availableRows>)
              ).map(([accommodationType, rows]) => (
                <optgroup key={accommodationType} label={accommodationType}>
                  {rows.map(row => (
                    <option key={row.id} value={row.item_id}>
                      {row.label} {row.is_assigned === false && '(available)'}
                    </option>
                  ))}
                </optgroup>
              ))
            ) : (
              // Single group for same accommodation type
              <optgroup label="Available Units">
                {availableRows.map(row => (
                  <option key={row.id} value={row.item_id}>
                    {row.label} {row.is_assigned === false && '(available)'}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleReassign}
            disabled={loading || !selectedItemId}
            className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 
                     disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Reassigning...' : 'Reassign'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)] 
                     rounded hover:bg-[var(--color-bg-surface-hover-2)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    {showCreateModal && (
      <CreateAccommodationItemModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onItemCreated={handleNewItemCreated}
        defaultAccommodationType={!canAssignAnywhere ? booking.accommodation_title : undefined}
      />
    )}
    </>
  );
}