import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '../../lib/supabase';
import { normalizeToUTCDate, formatDateForDisplay } from '../../utils/dates';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ApplicationDetails } from '../admin/ApplicationDetails';
import { CalendarHeader } from './CalendarHeader';
import { CalendarTable } from './CalendarTable';
import { Booking, AccommodationRow, ViewMode } from './types';
import { SINGLE_ROOMS, AUTO_ASSIGN_TYPES } from './utils';

interface Props {
  onClose: () => void;
}

export function InventoryCalendar({ onClose }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [accommodationRows, setAccommodationRows] = useState<AccommodationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    // Find the most recent Tuesday
    const dayOfWeek = now.getUTCDay();
    const daysToTuesday = dayOfWeek >= 2 ? dayOfWeek - 2 : 7 - (2 - dayOfWeek);
    const tuesday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToTuesday));
    return tuesday;
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [unlimitedAccommodations, setUnlimitedAccommodations] = useState<any[]>([]);
  
  // Mobile detection and state
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Compute accommodation rows with dynamic unlimited accommodation rows
  const accommodationRowsWithUnlimited = React.useMemo(() => {
    if (!unlimitedAccommodations.length) return accommodationRows;
    
    const rows = [...accommodationRows];
    
    // For each unlimited accommodation, add rows based on visible bookings
    for (const acc of unlimitedAccommodations) {
      // Count existing items for this accommodation already in rows
      const existingItemCount = rows.filter(r => r.accommodation_id === acc.id && r.item_id).length;
      
      // Count unassigned bookings for this accommodation type in the current view period
      const unassignedBookings = bookings.filter(b => 
        b.accommodation_id === acc.id && 
        !b.accommodation_item_id &&
        // Check if booking overlaps with current view
        ((viewMode === 'week' && b.check_out > currentWeekStart && b.check_in < new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) ||
         (viewMode === 'month' && b.check_out > currentMonth && b.check_in < new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)))
      );
      
      // Calculate how many unassigned slots we need
      // Group unassigned bookings by overlapping dates to determine minimum rows needed
      const neededSlots = calculateNeededSlots(unassignedBookings);
      
      // Add unassigned slots (only if we need more than existing items)
      for (let i = 0; i < neededSlots; i++) {
        rows.push({
          id: `${acc.id}-slot-${i}`,
          label: `?`,
          accommodation_title: acc.title,
          accommodation_id: acc.id,
          is_assigned: false
        });
      }
    }
    
    return rows;
  }, [accommodationRows, unlimitedAccommodations, bookings, viewMode, currentWeekStart, currentMonth]);

  // Helper function to calculate needed slots based on overlapping bookings
  function calculateNeededSlots(bookings: Booking[]): number {
    if (bookings.length === 0) return 0;
    
    // Sort bookings by check-in date
    const sorted = [...bookings].sort((a, b) => a.check_in.getTime() - b.check_in.getTime());
    
    // Track end dates of bookings in each slot
    const slots: Date[] = [];
    
    for (const booking of sorted) {
      // Find a slot where this booking can fit (no overlap)
      let assigned = false;
      for (let i = 0; i < slots.length; i++) {
        if (booking.check_in >= slots[i]) {
          slots[i] = booking.check_out;
          assigned = true;
          break;
        }
      }
      
      // If no slot available, create a new one
      if (!assigned) {
        slots.push(booking.check_out);
      }
    }
    
    return slots.length;
  }

  // Generate days based on view mode
  const daysToShow = viewMode === 'week' 
    ? Array.from({ length: 7 }, (_, i) => {
        const date = new Date(currentWeekStart);
        date.setUTCDate(date.getUTCDate() + i);
        return date;
      })
    : (() => {
        const firstDay = new Date(currentMonth);
        const lastDay = new Date(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 0);
        const days = [];
        for (let d = new Date(firstDay); d <= lastDay; d.setUTCDate(d.getUTCDate() + 1)) {
          days.push(new Date(d));
        }
        return days;
      })();

  useEffect(() => {
    loadAccommodations();
    loadQuestions();
  }, []);

  useEffect(() => {
    if (accommodationRows.length > 0) {
      loadBookings();
    }
  }, [currentWeekStart, currentMonth, viewMode, accommodationRows]);

  // Restore scroll position after loading
  useEffect(() => {
    if (!loading && scrollPosition > 0) {
      const scrollEl = document.querySelector('.inventory-calendar-scroll');
      if (scrollEl) {
        scrollEl.scrollTop = scrollPosition;
      }
    }
  }, [loading, scrollPosition]);

  async function loadQuestions() {
    try {
      const { data, error: queryError } = await supabase
        .from('application_questions_2')
        .select('*')
        .order('order_number');

      if (queryError) throw queryError;
      setQuestions(data || []);
    } catch (err) {
      console.error('Error loading questions:', err);
    }
  }

  async function loadAccommodations() {
    try {
      // Get all accommodations (both limited and unlimited)
      const { data: allAccommodations, error: allAccError } = await supabase
        .from('accommodations')
        .select('*')
        .not('title', 'ilike', '%test%') // Exclude test rooms
        .order('title');

      if (allAccError) throw allAccError;

      // Separate limited and unlimited accommodations
      const accommodations = allAccommodations?.filter(acc => !acc.is_unlimited);
      const unlimitedAccoms = allAccommodations?.filter(acc => acc.is_unlimited);

      const { data: items, error: itemsError } = await supabase
        .from('accommodation_items_with_tags')
        .select('*')
        .not('accommodation_title', 'ilike', '%test%') // Exclude test items
        .order('accommodation_title')
        .order('item_id');

      if (itemsError) throw itemsError;

      // Get all bookings to determine which items are assigned
      const { data: allBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('accommodation_item_id')
        .eq('status', 'confirmed')
        .not('accommodation_item_id', 'is', null);

      if (bookingsError) throw bookingsError;

      const assignedItemIds = new Set(allBookings?.map(b => b.accommodation_item_id) || []);

      const rows: AccommodationRow[] = [];
      const singleRoomRows: AccommodationRow[] = [];
      const dormRows: AccommodationRow[] = [];
      const otherRows: AccommodationRow[] = [];

      // Process all accommodations (both limited and unlimited) and categorize them
      allAccommodations?.forEach(acc => {
        if (acc.title.includes('Dorm')) {
          // For dorms, create a row for each bed
          const bedCount = acc.title.includes('6-Bed') ? 6 : acc.title.includes('3-Bed') ? 3 : 1;
          for (let bed = 1; bed <= bedCount; bed++) {
            dormRows.push({
              id: `${acc.id}-bed-${bed}`,
              label: `Bed ${bed}`,
              accommodation_title: acc.title,
              accommodation_id: acc.id,
              is_bed: true,
              bed_number: bed
            });
          }
        } else if (SINGLE_ROOMS.some(room => acc.title === room)) {
          // Single rooms - just use the title as the label
          singleRoomRows.push({
            id: acc.id,
            label: acc.title,
            accommodation_title: acc.title,
            accommodation_id: acc.id
          });
        } else if (!acc.is_unlimited) {
          // Other limited accommodations (bell tents, etc) - use items if they exist
          const accItems = items?.filter(item => item.accommodation_id === acc.id) || [];
          
          if (accItems.length > 0) {
            // Add each item as a row with assignment status
            const itemRows = accItems.map(item => ({
              id: item.id,
              label: item.full_tag,
              accommodation_title: item.accommodation_title,
              accommodation_id: item.accommodation_id,
              item_id: item.id,
              is_assigned: assignedItemIds.has(item.id)
            }));
            
            // Sort by label only to maintain consistent order
            itemRows.sort((a, b) => a.label.localeCompare(b.label));
            
            otherRows.push(...itemRows);
          } else {
            // Fallback for accommodations without items
            otherRows.push({
              id: acc.id,
              label: acc.title,
              accommodation_title: acc.title,
              accommodation_id: acc.id
            });
          }
        } else {
          // Unlimited accommodations - process their items
          const accItems = items?.filter(item => item.accommodation_id === acc.id) || [];
          
          if (accItems.length > 0) {
            // Add each item as a row with assignment status
            const itemRows = accItems.map(item => ({
              id: item.id,
              label: item.full_tag,
              accommodation_title: item.accommodation_title,
              accommodation_id: item.accommodation_id,
              item_id: item.id,
              is_assigned: assignedItemIds.has(item.id)
            }));
            
            // Sort by label only to maintain consistent order
            itemRows.sort((a, b) => a.label.localeCompare(b.label));
            
            otherRows.push(...itemRows);
          }
        }
      });

      // Combine in the desired order: single rooms first, then others, then dorms
      rows.push(...singleRoomRows, ...otherRows, ...dormRows);

      // For unlimited accommodations, we'll add rows dynamically based on bookings later
      // For now, just store the unlimited accommodation info
      setUnlimitedAccommodations(unlimitedAccoms || []);

      setAccommodationRows(rows);
    } catch (err) {
      console.error('Error loading accommodations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load accommodations');
    }
  }

  async function loadBookings() {
    setLoading(true);
    setError(null);
    try {
      // Get availability data for the current period
      let utcStartDate: Date;
      let utcEndDate: Date;
      
      if (viewMode === 'week') {
        utcStartDate = normalizeToUTCDate(currentWeekStart);
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        utcEndDate = normalizeToUTCDate(weekEnd);
      } else {
        utcStartDate = normalizeToUTCDate(currentMonth);
        const monthEnd = new Date(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 0);
        utcEndDate = normalizeToUTCDate(monthEnd);
      }
      
      const startDate = formatDateForDisplay(utcStartDate);
      const endDate = formatDateForDisplay(utcEndDate);

      console.log('[InventoryCalendar] Fetching bookings for:', {
        startDate,
        endDate,
        utcStartDate: utcStartDate.toISOString(),
        utcEndDate: utcEndDate.toISOString()
      });

      // Fetch bookings that overlap with the current week
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings_with_items')
        .select(`
          id,
          check_in,
          check_out,
          status,
          guest_email,
          user_email,
          guest_name,
          first_name,
          last_name,
          user_id,
          application_id,
          accommodation_id,
          accommodation_item_id,
          item_tag,
          accommodations!inner(title)
        `)
        .eq('status', 'confirmed')
        .lte('check_in', endDate)
        .gte('check_out', startDate)
        .order('check_in');

      if (bookingsError) throw bookingsError;

      console.log('[InventoryCalendar] Bookings data:', bookingsData?.length || 0);
      
      // Debug log first few bookings
      if (bookingsData && bookingsData.length > 0) {
        console.log('[InventoryCalendar] Sample booking data:', bookingsData.slice(0, 3).map(b => ({
          id: b.id,
          accommodation_id: b.accommodation_id,
          accommodation_item_id: b.accommodation_item_id,
          accommodations: b.accommodations,
          guest_email: b.guest_email,
          check_in: b.check_in,
          check_out: b.check_out
        })));
      }

      // Process bookings
      const processedData = (bookingsData || []).map(booking => ({
        ...booking,
        accommodation_title: booking.accommodations?.title || 'Unknown',
        check_in: normalizeToUTCDate(new Date(booking.check_in)),
        check_out: normalizeToUTCDate(new Date(booking.check_out)),
        guest_email: booking.guest_email || booking.user_email,
      }));
      
      // Log "Staying with somebody" bookings
      const stayingWithSomebody = processedData.filter(b => 
        b.accommodation_title === 'Staying with somebody'
      );
      if (stayingWithSomebody.length > 0) {
        console.log('[InventoryCalendar] Staying with somebody bookings:', stayingWithSomebody);
      }

      setBookings(processedData);
      
      // After setting bookings, check if we need to create rows for unassigned bookings
      // This ensures unassigned bookings are still visible
      const unassignedBookings = processedData.filter(b => 
        !b.accommodation_item_id && 
        (b.accommodation_title?.includes('Bell Tent') || b.accommodation_title?.includes('Tipi'))
      );
      
      if (unassignedBookings.length > 0) {
        // We'll handle these in the display logic
        console.log('Found unassigned bookings:', unassignedBookings.length);
      }

    } catch (err) {
      console.error('[InventoryCalendar] Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const handleBookingClick = async (booking: Booking, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // If there's an application_id, fetch and show the application details
    if (booking.application_id) {
      try {
        const { data: appData, error } = await supabase
          .from('application_details')
          .select(`
            id,
            user_id,
            data,
            status,
            created_at,
            user_email,
            linked_name,
            linked_email,
            linked_application_id,
            last_sign_in_at,
            raw_user_meta_data,
            admin_verdicts,
            credits,
            final_action
          `)
          .eq('id', booking.application_id)
          .single();
          
        if (error) throw error;
        
        if (appData) {
          setSelectedApplication(appData);
        }
      } catch (err) {
        console.error('Error fetching application details:', err);
      }
    }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      const newDate = new Date(currentWeekStart);
      newDate.setUTCDate(newDate.getUTCDate() + (direction === 'prev' ? -7 : 7));
      setCurrentWeekStart(newDate);
    } else {
      const newDate = new Date(currentMonth);
      newDate.setUTCMonth(newDate.getUTCMonth() + (direction === 'prev' ? -1 : 1));
      setCurrentMonth(newDate);
    }
  };

  const saveScrollPosition = () => {
    const scrollEl = document.querySelector('.inventory-calendar-scroll');
    if (scrollEl) setScrollPosition(scrollEl.scrollTop);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="inventory-calendar-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-hidden"
      >
        <motion.div
          key="inventory-calendar-panel"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute inset-0 bg-[var(--color-bg-surface)]"
        >
          <div className="h-screen flex flex-col">
            <CalendarHeader
              viewMode={viewMode}
              currentWeekStart={currentWeekStart}
              currentMonth={currentMonth}
              daysToShow={daysToShow}
              onViewModeChange={setViewMode}
              onNavigate={handleNavigate}
              onClose={onClose}
              onSaveScroll={saveScrollPosition}
            />

            <div className="flex-1 overflow-auto p-6 inventory-calendar-scroll">
              {error && (
                <div className="mb-4 p-4 bg-[var(--color-bg-error)] border-l-4 border-red-500 rounded">
                  <p className="text-[var(--color-text-error)]">{error}</p>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center items-center h-96">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <CalendarTable
                    daysToShow={daysToShow}
                    accommodationRows={accommodationRowsWithUnlimited}
                    bookings={bookings}
                    viewMode={viewMode}
                    onBookingClick={handleBookingClick}
                    onBookingUpdate={() => {
                      loadAccommodations(); // Reload to update assignment status
                      loadBookings();
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {selectedApplication && (
        <ApplicationDetails
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          questions={questions}
        />
      )}
    </AnimatePresence>
  );
}