import React, { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { formatDateForDisplay } from '../../utils/dates';
import { AccommodationRow, Booking, ViewMode } from './types';
import { getBookingsForCell, getBookingColor, shouldShowName, SINGLE_ROOMS } from './utils';
import { ReassignModal } from './ReassignModal';
import { BookingSelectionModal } from './BookingSelectionModal';
import { RefreshCw } from 'lucide-react';

interface Props {
  daysToShow: Date[];
  accommodationRows: AccommodationRow[];
  bookings: Booking[];
  viewMode: ViewMode;
  onBookingClick: (booking: Booking, event: React.MouseEvent) => void;
  onBookingUpdate?: () => void;
}

export function CalendarTable({
  daysToShow,
  accommodationRows,
  bookings,
  viewMode,
  onBookingClick,
  onBookingUpdate
}: Props) {
  const [reassignBooking, setReassignBooking] = useState<Booking | null>(null);
  const [selectBookingModal, setSelectBookingModal] = useState<{bookings: Booking[], action: 'reassign' | 'view'} | null>(null);
  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{row: AccommodationRow, date: Date} | null>(null);
  
  // Filter accommodation rows to only show those with bookings in the current view
  const visibleRows = React.useMemo(() => {
    const viewStart = daysToShow[0];
    const viewEnd = new Date(daysToShow[daysToShow.length - 1]);
    viewEnd.setDate(viewEnd.getDate() + 1); // Include the last day
    
    return accommodationRows.filter(row => {
      // Always show single rooms (they're limited and important to see availability)
      if (SINGLE_ROOMS.includes(row.accommodation_title)) {
        return true;
      }
      
      // Always show dorm beds (limited capacity)
      if (row.is_bed) {
        return true;
      }
      
      // Show tagged rows that have assigned bookings
      if (row.item_id) {
        const hasAssignedBooking = bookings.some(b =>
          b.accommodation_item_id === row.item_id &&
          b.check_in < viewEnd && 
          b.check_out > viewStart
        );
        if (hasAssignedBooking) return true;
      }
      
      // Check if there are any bookings for this accommodation in the view
      const hasBookingsInView = bookings.some(booking => 
        booking.accommodation_id === row.accommodation_id &&
        (!row.item_id || booking.accommodation_item_id === row.item_id) &&
        booking.check_in < viewEnd && 
        booking.check_out > viewStart
      );
      
      return hasBookingsInView;
    });
  }, [accommodationRows, bookings, daysToShow]);
  
  // Create stable booking row mappings based on accommodation_id
  const bookingRowMaps = React.useMemo(() => {
    const maps = new Map<string, Map<string, number>>();
    
    // Get unique accommodation IDs
    const accommodationIds = new Set(visibleRows.map(r => r.accommodation_id));
    
    accommodationIds.forEach(accId => {
      // Get unassigned bookings for this accommodation
      const unassignedBookings = bookings.filter(b => 
        b.accommodation_id === accId && !b.accommodation_item_id
      );
      
      // Get unassigned rows for this accommodation
      const unassignedRows = visibleRows.filter(r => 
        r.accommodation_id === accId && !r.item_id
      );
      
      if (unassignedRows.length > 1 && unassignedBookings.length > 0) {
        const bookingMap = new Map<string, number>();
        
        // Sort bookings by check-in date
        const sortedBookings = unassignedBookings.sort((a, b) => a.check_in.getTime() - b.check_in.getTime());
        
        // Assign each booking to a row based on availability at check-in
        sortedBookings.forEach(booking => {
          const occupiedRows = new Set<number>();
          
          // Check which rows are occupied at this booking's check-in
          bookingMap.forEach((rowIndex, otherBookingId) => {
            const otherBooking = bookings.find(b => b.id === otherBookingId);
            if (otherBooking && 
                booking.check_in >= otherBooking.check_in && 
                booking.check_in < otherBooking.check_out) {
              occupiedRows.add(rowIndex);
            }
          });
          
          // Find first available row
          for (let i = 0; i < unassignedRows.length; i++) {
            if (!occupiedRows.has(i)) {
              bookingMap.set(booking.id, i);
              break;
            }
          }
        });
        
        maps.set(accId, bookingMap);
      }
    });
    
    return maps;
  }, [bookings, visibleRows]);
  
  const handleReassign = (bookingId: string, newItemId: string) => {
    // Trigger a refresh of the bookings
    if (onBookingUpdate) {
      onBookingUpdate();
    }
    setReassignBooking(null);
  };

  const handleDragStart = (booking: Booking, e: React.DragEvent) => {
    // Only allow dragging for reassignable bookings
    if (booking.accommodation_title?.includes('Bell Tent') || 
        booking.accommodation_title?.includes('Tipi') ||
        booking.accommodation_title === 'Staying with somebody' ||
        booking.accommodation_title === 'Your Own Tent' ||
        booking.accommodation_title === 'Van Parking') {
      setDraggedBooking(booking);
      e.dataTransfer.effectAllowed = 'move';
    } else {
      e.preventDefault();
    }
  };

  const handleDragOver = (row: AccommodationRow, date: Date, e: React.DragEvent) => {
    if (!draggedBooking) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell({ row, date });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the table entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCell(null);
    }
  };

  const handleDrop = async (row: AccommodationRow, date: Date, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCell(null);
    
    if (!draggedBooking || !row.item_id) {
      setDraggedBooking(null);
      return;
    }

    // Check if the drop is valid (within booking dates and on an item row)
    if (date >= draggedBooking.check_in && date < draggedBooking.check_out) {
      // Use the reassign modal's logic
      setReassignBooking(draggedBooking);
      // Auto-select the target item in the modal
      setTimeout(() => {
        const selectElement = document.querySelector('select[value=""]') as HTMLSelectElement;
        if (selectElement && row.item_id) {
          selectElement.value = row.item_id;
        }
      }, 100);
    }
    
    setDraggedBooking(null);
  };

  return (
    <>
      <table className="min-w-[800px] border-collapse table-fixed">
      <colgroup>
        <col className="w-48" />
        {daysToShow.map((_, i) => (
          <col key={i} className={viewMode === 'month' ? 'w-24' : 'w-32'} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-20 bg-[var(--color-bg-surface)]">
        <tr>
          <th className="p-2 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase border-r border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] h-16">
            Accommodation
          </th>
          {daysToShow.map(day => (
            <th key={day.toISOString()} className={`p-2 text-center border-r border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] h-16`}>
              <div className="text-xs font-medium text-[var(--color-text-secondary)]">
                {formatInTimeZone(day, 'UTC', viewMode === 'month' ? 'E' : 'EEE')}
              </div>
              <div className={`font-medium text-[var(--color-text-primary)] ${viewMode === 'month' ? 'text-sm' : 'text-lg'}`}>
                {formatInTimeZone(day, 'UTC', 'd')}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {visibleRows.map((row, rowIndex) => {
          // Determine if we should show a header
          const isSingleRoom = SINGLE_ROOMS.includes(row.accommodation_title);
          const prevRow = rowIndex > 0 ? visibleRows[rowIndex - 1] : null;
          const prevIsSingleRoom = prevRow && SINGLE_ROOMS.includes(prevRow.accommodation_title);
          
          let showAccommodationHeader = false;
          let headerText = '';
          
          if (rowIndex === 0) {
            showAccommodationHeader = true;
            headerText = isSingleRoom ? 'Single Rooms' : row.accommodation_title;
          } else if (isSingleRoom && !prevIsSingleRoom) {
            showAccommodationHeader = true;
            headerText = 'Single Rooms';
          } else if (!isSingleRoom && prevRow && prevRow.accommodation_title !== row.accommodation_title) {
            showAccommodationHeader = true;
            headerText = row.accommodation_title;
          }
          
          return (
            <React.Fragment key={row.id}>
              {showAccommodationHeader && (
                <tr className="h-8">
                  <td className="bg-[var(--color-bg-surface-hover)] px-3 py-1 text-sm font-semibold text-[var(--color-text-primary)] border-r border-b border-[var(--color-border)] h-8">
                    {headerText}
                  </td>
                  {daysToShow.map((_, i) => (
                    <td key={i} className="bg-[var(--color-bg-surface-hover)] border-r border-b border-[var(--color-border)] h-8"></td>
                  ))}
                </tr>
              )}
              <tr className={`hover:bg-[var(--color-bg-surface-hover)] ${row.is_assigned === false ? 'opacity-50' : ''} h-12`}>
                <td className={`sticky left-0 z-10 bg-[var(--color-bg-surface)] px-3 py-2 text-sm font-medium border-r border-b border-[var(--color-border)] ${
                  row.is_assigned === false ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'
                } h-12 w-48`}>
                  <div className="truncate">
                    {row.is_assigned === false ? '?' : row.label}
                  </div>
                </td>
                {daysToShow.map(day => {
                  const cellBookings = getBookingsForCell(row, day, bookings, visibleRows, bookingRowMaps);
                  const hasBookings = cellBookings.length > 0;
                  
                  // Debug: Log cells with multiple bookings
                  if (cellBookings.length > 2) {
                    console.log('Cell with 3+ bookings:', {
                      row: row.label,
                      day: formatDateForDisplay(day),
                      bookings: cellBookings.map(b => ({
                        id: b.id,
                        name: b.first_name || b.guest_name || b.guest_email,
                        accommodation_title: b.accommodation_title,
                        item_id: b.accommodation_item_id
                      }))
                    });
                  }
                  
                  // Check if any booking in this cell is reassignable
                  const isReassignable = hasBookings && cellBookings.some(booking => 
                    booking.accommodation_title?.includes('Bell Tent') || 
                    booking.accommodation_title?.includes('Tipi') ||
                    booking.accommodation_title === 'Staying with somebody' ||
                    booking.accommodation_title === 'Your Own Tent' ||
                    booking.accommodation_title === 'Van Parking'
                  );
                  
                  // Check if this cell is being dragged over
                  const isDragOver = dragOverCell?.row.id === row.id && 
                                   dragOverCell?.date.getTime() === day.getTime();

                  // Create cell content for multiple bookings
                  const cellContentData = cellBookings.map((booking, idx) => {
                    const isFirstDay = formatDateForDisplay(booking.check_in) === formatDateForDisplay(day);
                    const isCheckoutDay = formatDateForDisplay(booking.check_out) === formatDateForDisplay(day);
                    const showName = shouldShowName(booking, day, isFirstDay, viewMode, daysToShow);
                    const displayName = booking.first_name || 
                      booking.guest_name?.split(' ')[0] || 
                      booking.guest_email?.split('@')[0] || 
                      'Guest';
                    
                    return {
                      booking,
                      displayName,
                      showName,
                      isFirstDay,
                      isCheckoutDay
                    };
                  });

                  // Check if this is a checkout day for any booking
                  const isCheckoutCell = cellContentData.some(d => d.isCheckoutDay);
                  
                  // Determine background color - if multiple bookings, use a mixed color
                  let bgColorClass = '';
                  let cellStyle: React.CSSProperties = {};
                  let isUnassignedStaying = false;
                  
                  if (hasBookings) {
                    // Check if this is an unassigned booking
                    const hasUnassignedBooking = cellBookings.some(b => 
                      !b.accommodation_item_id && (
                        b.accommodation_title === 'Staying with somebody' ||
                        b.accommodation_title?.includes('Bell Tent') ||
                        b.accommodation_title?.includes('Tipi') ||
                        b.accommodation_title === 'Your Own Tent' ||
                        b.accommodation_title === 'Van Parking'
                      )
                    );
                    
                    if (cellBookings.length === 1) {
                      const booking = cellBookings[0];
                      const isUnassigned = !booking.accommodation_item_id && (
                        booking.accommodation_title === 'Staying with somebody' ||
                        booking.accommodation_title?.includes('Bell Tent') ||
                        booking.accommodation_title?.includes('Tipi') ||
                        booking.accommodation_title === 'Your Own Tent' ||
                        booking.accommodation_title === 'Van Parking'
                      );
                      
                      const baseColor = getBookingColor(booking);
                      
                      if (isCheckoutCell) {
                        // Checkout day - create a triangle in top-left corner
                        // We'll use a simpler approach with clip-path
                        bgColorClass = '';
                        cellStyle = {
                          position: 'relative',
                          background: 'transparent'
                        };
                      } else if (isUnassigned) {
                        // Unassigned bookings - slightly faded
                        bgColorClass = baseColor + ' text-white opacity-60';
                        isUnassignedStaying = true;
                      } else {
                        bgColorClass = baseColor + ' text-white';
                      }
                    } else {
                      // Multiple bookings - use a special color
                      if (isCheckoutCell) {
                        cellStyle = {
                          background: `linear-gradient(135deg, rgba(168, 85, 247, 0.7) 50%, transparent 50%)`,
                        };
                        bgColorClass = 'text-white';
                      } else {
                        bgColorClass = 'bg-gradient-to-r from-purple-500/70 to-pink-500/70 text-white';
                      }
                    }
                  } else if (row.is_assigned === false) {
                    bgColorClass = 'bg-gray-100/50 dark:bg-gray-800/30';
                  } else {
                    bgColorClass = 'bg-[var(--color-bg-surface)]';
                  }

                  // Create tooltip showing all guests
                  const tooltipText = cellBookings.length > 0 
                    ? cellBookings.map(b => {
                        const guestInfo = `${b.guest_name || b.guest_email || 'Guest'}: ${formatInTimeZone(b.check_in, 'UTC', 'MMM d')} - ${formatInTimeZone(b.check_out, 'UTC', 'MMM d')}`;
                        const isUnassigned = !b.accommodation_item_id && (
                          b.accommodation_title === 'Staying with somebody' ||
                          b.accommodation_title?.includes('Bell Tent') ||
                          b.accommodation_title?.includes('Tipi') ||
                          b.accommodation_title === 'Your Own Tent' ||
                          b.accommodation_title === 'Van Parking'
                        );
                        if (isUnassigned) {
                          return guestInfo + ' (Unassigned - click to assign)';
                        }
                        return guestInfo;
                      }).join('\n') + (isReassignable && !isUnassignedStaying ? '\n\nClick to manage assignments' : '')
                    : undefined;

                  return (
                    <td 
                      key={day.toISOString()} 
                      className={`px-2 py-1 border-r border-b border-[var(--color-border)] h-12 ${bgColorClass} ${hasBookings && isReassignable ? 'cursor-move hover:opacity-80' : ''} ${isDragOver ? 'ring-2 ring-emerald-500 ring-inset' : ''} relative transition-all`}
                      style={cellStyle}
                      draggable={hasBookings && isReassignable && !isCheckoutCell}
                      onDragStart={hasBookings && isReassignable && !isCheckoutCell ? (e) => handleDragStart(cellBookings[0], e) : undefined}
                      onDragOver={(e) => handleDragOver(row, day, e)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(row, day, e)}
                      onClick={hasBookings ? (e) => {
                        
                        // Allow reassignment in both week and month views
                        if (!isReassignable) return;
                        // Handle cell click for reassignment
                        // Check if we clicked on the name span - if so, ignore
                        const target = e.target as HTMLElement;
                        if (target.tagName === 'SPAN' && target.classList.contains('cursor-pointer')) {
                          return;
                        }
                        
                        e.stopPropagation();
                        
                        // Get all reassignable bookings in this cell
                        const reassignableBookings = cellBookings.filter(b => 
                          b.accommodation_title?.includes('Bell Tent') || 
                          b.accommodation_title?.includes('Tipi') ||
                          b.accommodation_title === 'Staying with somebody' ||
                          b.accommodation_title === 'Your Own Tent' ||
                          b.accommodation_title === 'Van Parking'
                        );
                        
                        console.log('Reassignable bookings:', {
                          total: cellBookings.length,
                          reassignable: reassignableBookings.length,
                          bookings: reassignableBookings.map(b => ({
                            name: b.first_name || b.guest_name || b.guest_email,
                            title: b.accommodation_title
                          }))
                        });
                        
                        if (reassignableBookings.length === 1) {
                          // Single reassignable booking - open reassign modal directly
                          setReassignBooking(reassignableBookings[0]);
                        } else if (reassignableBookings.length > 1) {
                          // Multiple reassignable bookings - show selection modal
                          setSelectBookingModal({ bookings: reassignableBookings, action: 'reassign' });
                        }
                      } : undefined}
                      title={tooltipText}
                    >
                      {isCheckoutCell && cellBookings.length === 1 && (
                        <div 
                          className={`absolute inset-0 ${getBookingColor(cellBookings[0])}`}
                          style={{
                            clipPath: 'polygon(0 0, 100% 0, 0 100%)'
                          }}
                        />
                      )}
                      {isCheckoutCell && cellBookings.length > 1 && (
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-purple-500/70 to-pink-500/70"
                          style={{
                            clipPath: 'polygon(0 0, 100% 0, 0 100%)'
                          }}
                        />
                      )}
                      {hasBookings && (
                        <div className={`font-medium text-center ${viewMode === 'month' ? 'text-xs px-1' : 'text-xs'} ${cellBookings.length > 1 ? 'flex flex-col' : ''} ${isCheckoutCell ? 'relative z-10' : ''}`}>
                          {viewMode === 'month' ? (
                            // Month view - show names as clickable links
                            cellContentData.filter(d => d.showName || d.isCheckoutDay).map((data, idx) => (
                              <span
                                key={data.booking.id}
                                className={`cursor-pointer hover:underline ${data.isCheckoutDay ? 'text-white font-bold' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onBookingClick(data.booking, e);
                                }}
                              >
                                {data.isCheckoutDay ? 'Out' : data.displayName}
                              </span>
                            ))
                          ) : (
                            // Week view - show with arrows and clickable names
                            cellContentData.slice(0, 2).map((data, idx) => (
                              <div key={data.booking.id} className="truncate">
                                {data.isFirstDay && !data.isCheckoutDay && <span className="mr-1">→</span>}
                                {(data.showName || data.isCheckoutDay) && (
                                  <span
                                    className={`cursor-pointer hover:underline relative z-10 ${data.isCheckoutDay ? 'text-white font-bold' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onBookingClick(data.booking, e);
                                    }}
                                  >
                                    {data.isCheckoutDay ? 'Out' : data.displayName}
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                          {cellBookings.length > 2 && viewMode === 'week' && (
                            <div className="text-xs opacity-70">+{cellBookings.length - 2}</div>
                          )}
                          {isReassignable && viewMode === 'week' && cellBookings.length === 1 && cellContentData[0]?.showName && (
                            <RefreshCw className="inline-block w-3 h-3 ml-1 opacity-50" />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </table>

    {reassignBooking && (
      <ReassignModal
        booking={reassignBooking}
        accommodationRows={accommodationRows}
        onClose={() => setReassignBooking(null)}
        onReassign={handleReassign}
      />
    )}
    
    {selectBookingModal && (
      <BookingSelectionModal
        bookings={selectBookingModal.bookings}
        title={selectBookingModal.action === 'reassign' ? 'Select Guest to Reassign' : 'Select Guest to View'}
        onSelect={(booking) => {
          if (selectBookingModal.action === 'reassign') {
            setReassignBooking(booking);
          } else {
            onBookingClick(booking, new MouseEvent('click'));
          }
          setSelectBookingModal(null);
        }}
        onClose={() => setSelectBookingModal(null)}
      />
    )}
    </>
  );
}