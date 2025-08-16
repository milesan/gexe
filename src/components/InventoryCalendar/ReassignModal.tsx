import React, { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Booking, AccommodationRow } from './types';
import { formatInTimeZone } from 'date-fns-tz';
import { CreateAccommodationItemModal } from './CreateAccommodationItemModal';
import { ACCOMMODATION_IDS, UNLIMITED_ACCOMMODATION_TYPES } from './constants';
import { isDormAccommodation } from './helpers';

interface Props {
  booking: Booking;
  accommodationRows: AccommodationRow[];
  onClose: () => void;
  onReassign: (bookingId: string, newItemId: string) => void;
  onDataUpdate?: () => void;
}

export function ReassignModal({ booking, accommodationRows, onClose, onReassign, onDataUpdate }: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string>(booking.accommodation_item_id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Determine booking type for filtering
  const canAssignAnywhere = UNLIMITED_ACCOMMODATION_TYPES.includes(
    booking.accommodation_title as any
  );
  
  const isDormBooking = isDormAccommodation(booking.accommodation_id);
  const isDorm3Booking = booking.accommodation_id === ACCOMMODATION_IDS.DORM_3_BED;
  const isDorm6Booking = booking.accommodation_id === ACCOMMODATION_IDS.DORM_6_BED;
  
  const handleNewItemCreated = async (newItemId: string) => {
    // Close the create modal
    setShowCreateModal(false);
    
    // Set the newly created item as selected
    setSelectedItemId(newItemId);
    
    // Trigger the reassignment
    await handleReassign(newItemId);
  };

  const handleDeleteTag = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this tag? This cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Delete the accommodation item
      const { error: deleteError } = await supabase
        .from('accommodation_items')
        .delete()
        .eq('id', itemId);
      
      if (deleteError) throw deleteError;
      
      console.log('✅ Deleted accommodation tag:', itemId);
      
      // Call the data update callback to refresh the data
      if (onDataUpdate) {
        onDataUpdate();
      }
      
      // Don't close the modal - user might want to delete more tags or reassign
    } catch (err: any) {
      console.error('Delete tag error:', err);
      setError(err.message || 'Failed to delete tag');
    } finally {
      setLoading(false);
    }
  };

  const availableRows = accommodationRows.filter(row => {
    // Must have an item_id (be a real tag, not a placeholder)
    if (!row.item_id) return false;
    
    // Show dorm bed tags (with item_id) but not automatic dorm bed rows (is_bed flag)
    if (row.is_bed) return false;
    // But allow actual dorm bed tags that were created
    // (these will have item_id but not is_bed flag)
    
    // For "Staying with somebody" - show ALL accommodation items
    if (booking.accommodation_title === 'Staying with somebody') {
      return true;
    }
    
    // For dorm bookings - show only tags with matching accommodation_id
    if (isDormBooking) {
      // Simply filter by accommodation_id - this automatically gives us the right bed tags
      // 3-Bed Dorm tags will only match 3-Bed Dorm accommodation_id
      // 6-Bed Dorm tags will only match 6-Bed Dorm accommodation_id
      return row.accommodation_id === booking.accommodation_id;
    }
    
    // For all other accommodations - show items with same accommodation_id
    // This works for Van Parking, Your Own Tent, Bell Tents, Tipis, etc.
    return row.accommodation_id === booking.accommodation_id;
  });


  const handleReassign = async (itemIdToAssign?: string) => {
    const itemId = itemIdToAssign || selectedItemId;
    
    // Ensure itemId is a string, not an object
    if (typeof itemId === 'object') {
      console.error('Invalid itemId - received object instead of string:', itemId);
      setError('Invalid accommodation selection');
      return;
    }
    
    const itemIdString = String(itemId);
    
    if (!itemIdString || itemIdString === '' || itemIdString === booking.accommodation_item_id) {
      setError('Please select a different accommodation item');
      return;
    }

    console.log('Reassigning booking:', {
      booking_id: booking.id,
      booking_title: booking.accommodation_title,
      from_item: booking.accommodation_item_id,
      to_item: itemIdString,
      is_staying_with_somebody: booking.accommodation_title === 'Staying with somebody'
    });

    setLoading(true);
    setError(null);

    try {
      if (itemIdString === 'unassigned') {
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
            p_accommodation_item_id: itemIdString
          });

        if (reassignError) throw reassignError;
      }
      
      // If no error, the reassignment was successful
      onReassign(booking.id, itemIdString);
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
            {booking.accommodation_title === 'Staying with somebody' 
              ? 'Select Host Accommodation' 
              : isDormBooking
              ? 'Reassign to Dorm Bed'
              : 'Reassign Accommodation'}
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
              {booking.item_tag ? (
                // Simplify dorm bed tags
                isDormBooking && booking.item_tag.match(/D[36].*?(\d+)$/)
                  ? `Bed ${booking.item_tag.match(/D[36].*?(\d+)$/)?.[1]}`
                  : booking.item_tag
              ) : booking.accommodation_title}
            </span>
          </p>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--color-text-primary)] block mb-2">
            {isDormBooking 
              ? `Select ${isDorm3Booking ? 'D3' : 'D6'} bed tag:` 
              : 'Select new accommodation:'}
          </label>
          <p className="text-xs text-[var(--color-text-secondary)] mb-2">
            Click a tag to select it. Hover to see delete option (non-dorm tags only).
          </p>
          
          {/* Options list with delete buttons */}
          <div className="max-h-64 overflow-y-auto border border-[var(--color-border)] rounded bg-[var(--color-bg-surface)]">
            {/* Unassigned option */}
            <div 
              className={`p-2 cursor-pointer hover:bg-[var(--color-bg-surface-hover)] ${selectedItemId === 'unassigned' ? 'bg-emerald-500/20' : ''}`}
              onClick={() => setSelectedItemId('unassigned')}
            >
              ⚪ Unassigned
            </div>
            
            {/* Create new tag option */}
            {!isDormBooking && (
              <div 
                className="p-2 cursor-pointer hover:bg-[var(--color-bg-surface-hover)] text-emerald-500 font-medium"
                onClick={() => setShowCreateModal(true)}
              >
                ➕ Create New Tag
              </div>
            )}
            
            {availableRows.length === 0 ? (
              <div className="p-2 text-[var(--color-text-secondary)]">
                No tags available - use Admin Panel to create tags
              </div>
            ) : canAssignAnywhere ? (
              // Group by accommodation type for flexible assignment types
              Object.entries(
                availableRows.reduce((groups, row) => {
                  const type = row.accommodation_title;
                  if (!groups[type]) groups[type] = [];
                  groups[type].push(row);
                  return groups;
                }, {} as Record<string, typeof availableRows>)
              ).map(([accommodationType, rows]) => (
                <div key={accommodationType} className="mt-2">
                  <div className="text-xs text-[var(--color-text-secondary)] px-2 py-1">
                    {accommodationType}
                  </div>
                  {rows.map(row => {
                    // Check if this is a dorm tag (based on accommodation_id)
                    const isDormTag = isDormAccommodation(row.accommodation_id);
                    
                    return (
                      <div key={row.id} className="flex items-center justify-between group">
                        <div 
                          className={`flex-1 p-2 cursor-pointer hover:bg-[var(--color-bg-surface-hover)] ${selectedItemId === (row.item_id || row.id) ? 'bg-emerald-500/20' : ''}`}
                          onClick={() => setSelectedItemId(row.item_id || row.id)}
                        >
                          {row.label} {row.is_assigned === false && '(available)'}
                        </div>
                        {!isDormTag && row.item_id && (
                          <button
                            onClick={() => handleDeleteTag(row.item_id!)}
                            disabled={loading}
                            className="p-1 mr-2 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete tag"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              // Single group for same accommodation type
              <div className="mt-2">
                <div className="text-xs text-[var(--color-text-secondary)] px-2 py-1">
                  {isDormBooking ? "Available Beds" : "Available Units"}
                </div>
                {availableRows.map(row => {
                  // Check if this is a dorm tag
                  const isDormTag = isDormBooking;
                  
                  return (
                    <div key={row.id} className="flex items-center justify-between group">
                      <div 
                        className={`flex-1 p-2 cursor-pointer hover:bg-[var(--color-bg-surface-hover)] ${selectedItemId === (row.item_id || row.id) ? 'bg-emerald-500/20' : ''}`}
                        onClick={() => setSelectedItemId(row.item_id || row.id)}
                      >
                        {row.label} {row.is_assigned === false && '(available)'}
                      </div>
                      {!isDormTag && row.item_id && (
                        <button
                          onClick={() => handleDeleteTag(row.item_id!)}
                          className="p-1 mr-2 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete tag"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleReassign()}
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
        defaultAccommodationType={booking.accommodation_title}
      />
    )}
    </>
  );
}
