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
  
  // Create stable booking row mappings for all accommodation types
  const bookingRowMaps = React.useMemo(() => {
    const maps = new Map<string, Map<string, number>>();
    
    // Get unique accommodation types
    const accommodationTypes = new Set(accommodationRows.map(r => r.accommodation_title));
    
    accommodationTypes.forEach(type => {
      const typeRows = accommodationRows.filter(r => r.accommodation_title === type);
      const typeBookings = bookings.filter(b => b.accommodation_title === type && !b.accommodation_item_id);
      
      if (typeRows.length > 1 && typeBookings.length > 0) {
        const bookingMap = new Map<string, number>();
        
        // Sort bookings by check-in date
        const sortedBookings = typeBookings.sort((a, b) => a.check_in.getTime() - b.check_in.getTime());
        
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
          for (let i = 0; i < typeRows.length; i++) {
            if (!occupiedRows.has(i)) {
              bookingMap.set(booking.id, i);
              break;
            }
          }
        });
        
        maps.set(type, bookingMap);
      }
    });
    
    return maps;
  }, [bookings, accommodationRows]);
  
  const handleReassign = (bookingId: string, newItemId: string) => {
    // Trigger a refresh of the bookings
    if (onBookingUpdate) {
      onBookingUpdate();
    }
    setReassignBooking(null);
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
        {accommodationRows.map((row, rowIndex) => {
          // Determine if we should show a header
          const isSingleRoom = SINGLE_ROOMS.includes(row.accommodation_title);
          const prevRow = rowIndex > 0 ? accommodationRows[rowIndex - 1] : null;
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
                  const cellBookings = getBookingsForCell(row, day, bookings, accommodationRows, bookingRowMaps);
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
                  

                  // Create cell content for multiple bookings
                  const cellContentData = cellBookings.map((booking, idx) => {
                    const isFirstDay = formatDateForDisplay(booking.check_in) === formatDateForDisplay(day);
                    const isLastDay = formatDateForDisplay(booking.check_out) === formatDateForDisplay(day);
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
                      isLastDay
                    };
                  });

                  // Determine background color - if multiple bookings, use a mixed color
                  let bgColorClass = '';
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
                      
                      if (isUnassigned) {
                        // Unassigned bookings - slightly faded
                        bgColorClass = getBookingColor(booking) + ' text-white opacity-60';
                        isUnassignedStaying = true;
                      } else {
                        bgColorClass = getBookingColor(booking) + ' text-white';
                      }
                    } else {
                      // Multiple bookings - use a special color
                      bgColorClass = 'bg-gradient-to-r from-purple-500/70 to-pink-500/70 text-white';
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
                      className={`px-2 py-1 border-r border-b border-[var(--color-border)] h-12 ${bgColorClass} ${hasBookings && isReassignable ? 'cursor-move hover:opacity-80' : ''} relative`}
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
                      {hasBookings && (
                        <div className={`font-medium text-center ${viewMode === 'month' ? 'text-xs px-1' : 'text-xs'} ${cellBookings.length > 1 ? 'flex flex-col' : ''}`}>
                          {viewMode === 'month' ? (
                            // Month view - show names as clickable links
                            cellContentData.filter(d => d.showName).map((data, idx) => (
                              <span
                                key={data.booking.id}
                                className="cursor-pointer hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onBookingClick(data.booking, e);
                                }}
                              >
                                {data.displayName}
                              </span>
                            ))
                          ) : (
                            // Week view - show with arrows and clickable names
                            cellContentData.slice(0, 2).map((data, idx) => (
                              <div key={data.booking.id} className="truncate">
                                {data.isFirstDay && <span className="mr-1">→</span>}
                                {data.showName && (
                                  <span
                                    className="cursor-pointer hover:underline relative z-10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onBookingClick(data.booking, e);
                                    }}
                                  >
                                    {data.displayName}
                                  </span>
                                )}
                                {data.isLastDay && <span className="ml-1">←</span>}
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