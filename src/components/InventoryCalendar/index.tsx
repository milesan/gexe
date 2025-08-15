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
// import { DebugVanParking } from './DebugVanParking';
// import { DebugDorms } from './DebugDorms';
// import { TestDormBookings } from './TestDormBookings';

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
    // Find the most recent Monday (start of week for checkout/checkin cycle)
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so we need to go back 6 days
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday));
    return monday;
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
    
    // Separate existing Van Parking and Staying with somebody rows from others
    const vanParkingRows = accommodationRows.filter(r => r.accommodation_title === 'Van Parking');
    const stayingWithRows = accommodationRows.filter(r => r.accommodation_title === 'Staying with somebody');
    const otherRows = accommodationRows.filter(r => 
      r.accommodation_title !== 'Van Parking' && 
      r.accommodation_title !== 'Staying with somebody'
    );
    
    const additionalVanParkingRows: AccommodationRow[] = [];
    const additionalStayingWithRows: AccommodationRow[] = [];
    const additionalOtherRows: AccommodationRow[] = [];
    
    // For each unlimited accommodation, add rows based on UNASSIGNED bookings only
    for (const acc of unlimitedAccommodations) {
      // Get view period bounds
      let viewStart: Date;
      let viewEnd: Date;
      
      if (viewMode === 'week') {
        viewStart = currentWeekStart;
        viewEnd = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else {
        viewStart = currentMonth;
        viewEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      }
      
      // For "Van Parking" and "Staying with somebody", only count UNASSIGNED bookings
      // Assigned bookings already have their tag rows
      let unassignedBookings;
      if (acc.title === 'Van Parking' || acc.title === 'Staying with somebody') {
        unassignedBookings = bookings.filter(b => {
          return b.accommodation_title === acc.title &&
            !b.accommodation_item_id && // Only unassigned bookings
            // Check if booking is active during ANY part of the view period (including checkout on first day)
            b.check_in < viewEnd && b.check_out >= viewStart;
        });
        console.log(`Found ${unassignedBookings.length} unassigned ${acc.title} bookings in view`);
      } else if (acc.title === 'Your Own Tent') {
        // For Your Own Tent, also only count unassigned bookings
        unassignedBookings = bookings.filter(b => {
          return b.accommodation_title === acc.title &&
            !b.accommodation_item_id && // Only unassigned bookings
            // Check if booking is active during ANY part of the view period (including checkout on first day)
            b.check_in < viewEnd && b.check_out >= viewStart;
        });
        console.log(`Found ${unassignedBookings.length} unassigned ${acc.title} bookings in view`);
      } else {
        // For other unlimited types, only count unassigned bookings
        unassignedBookings = bookings.filter(b => 
          b.accommodation_id === acc.id && 
          !b.accommodation_item_id &&
          // Check if booking is active during ANY part of the view period (including checkout on first day)
          b.check_in < viewEnd && b.check_out >= viewStart
        );
      }
      
      // Calculate needed rows based on overlapping bookings
      let neededRows = 0;
      if (unassignedBookings.length > 0) {
        // Sort bookings by check-in date
        const sortedBookings = [...unassignedBookings].sort((a, b) => 
          a.check_in.getTime() - b.check_in.getTime()
        );
        
        // Track which row each booking is assigned to
        const rowAssignments: Date[][] = []; // Each row tracks checkout dates
        
        for (const booking of sortedBookings) {
          // Find first available row (where booking doesn't overlap)
          let assignedRow = -1;
          for (let rowIdx = 0; rowIdx < rowAssignments.length; rowIdx++) {
            // Check if booking overlaps with any booking in this row
            const overlaps = rowAssignments[rowIdx].some(checkoutDate => 
              booking.check_in < checkoutDate
            );
            if (!overlaps) {
              assignedRow = rowIdx;
              break;
            }
          }
          
          // If no available row found, create new row
          if (assignedRow === -1) {
            assignedRow = rowAssignments.length;
            rowAssignments.push([]);
          }
          
          // Assign booking to row
          rowAssignments[assignedRow].push(booking.check_out);
        }
        
        neededRows = rowAssignments.length;
        console.log(`${acc.title} needs ${neededRows} rows for ${unassignedBookings.length} bookings`);
      }
      
      // Add the needed rows
      for (let i = 0; i < neededRows; i++) {
        const newRow = {
          id: `${acc.id}-unassigned-${i}`,
          label: `${acc.title} (Unassigned ${i + 1})`,
          accommodation_title: acc.title,
          accommodation_id: acc.id,
          is_assigned: false
        };
        
        // Group by type
        if (acc.title === 'Van Parking') {
          additionalVanParkingRows.push(newRow);
        } else if (acc.title === 'Staying with somebody') {
          additionalStayingWithRows.push(newRow);
        } else {
          additionalOtherRows.push(newRow);
        }
      }
    }
    
    // Combine in order: other rows, then all Van Parking (assigned tags first, then unassigned), then all Staying with somebody
    return [
      ...otherRows,
      ...additionalOtherRows,
      ...vanParkingRows, // Existing Van Parking tags (assigned or empty)
      ...additionalVanParkingRows, // Unassigned Van Parking bookings
      ...stayingWithRows, // Existing Staying with somebody tags
      ...additionalStayingWithRows // Unassigned Staying with somebody bookings
    ];
  }, [accommodationRows, unlimitedAccommodations, bookings, viewMode, currentWeekStart, currentMonth]);

  // Helper function to calculate needed slots based on overlapping bookings IN THE CURRENT VIEW
  function calculateNeededSlots(bookings: Booking[], viewStart?: Date, viewEnd?: Date): number {
    if (bookings.length === 0) return 0;
    
    // If we have view bounds, we need to consider overlaps within the view
    // Two bookings that don't overlap in general might both be visible in the same week
    if (viewStart && viewEnd) {
      // For each day in the view, count max concurrent bookings
      let maxConcurrent = 0;
      const currentDate = new Date(viewStart);
      
      while (currentDate < viewEnd) {
        const bookingsOnThisDay = bookings.filter(b => 
          currentDate >= b.check_in && currentDate < b.check_out
        );
        maxConcurrent = Math.max(maxConcurrent, bookingsOnThisDay.length);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // However, we also need to ensure each booking gets its own row if they don't overlap at all
      // This handles the case where one booking ends and another starts in the same view
      const nonOverlappingGroups: Booking[][] = [];
      
      for (const booking of bookings) {
        let placed = false;
        for (const group of nonOverlappingGroups) {
          // Check if this booking overlaps with any in the group
          const hasOverlap = group.some(b => 
            booking.check_in < b.check_out && booking.check_out > b.check_in
          );
          if (!hasOverlap) {
            group.push(booking);
            placed = true;
            break;
          }
        }
        if (!placed) {
          nonOverlappingGroups.push([booking]);
        }
      }
      
      // Return the maximum of concurrent bookings or number of non-overlapping groups
      return Math.max(maxConcurrent, nonOverlappingGroups.length);
    }
    
    // Original logic for when we don't have view bounds
    const sorted = [...bookings].sort((a, b) => a.check_in.getTime() - b.check_in.getTime());
    const slots: Date[] = [];
    
    for (const booking of sorted) {
      let assigned = false;
      for (let i = 0; i < slots.length; i++) {
        if (booking.check_in >= slots[i]) {
          slots[i] = booking.check_out;
          assigned = true;
          break;
        }
      }
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      switch(e.key.toLowerCase()) {
        case 't':
          handleGoToToday();
          break;
        case 'arrowleft':
          e.preventDefault();
          saveScrollPosition();
          handleNavigate('prev');
          break;
        case 'arrowright':
          e.preventDefault();
          saveScrollPosition();
          handleNavigate('next');
          break;
        case 'w':
          if (viewMode !== 'week') {
            saveScrollPosition();
            setViewMode('week');
          }
          break;
        case 'm':
          if (viewMode !== 'month') {
            saveScrollPosition();
            setViewMode('month');
          }
          break;
        case 'escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [viewMode, currentWeekStart, currentMonth, onClose]);

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

      console.log('All accommodations loaded:', allAccommodations?.map(a => ({ 
        id: a.id, 
        title: a.title, 
        type: a.type,
        inventory: a.inventory,
        is_unlimited: a.is_unlimited 
      })));

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
      const specialAccommodationRows: AccommodationRow[] = []; // For "Your Own Tent", "Van Parking", "Staying with somebody"

      // Process all accommodations (both limited and unlimited) and categorize them
      allAccommodations?.forEach(acc => {
        if (acc.title.includes('Dorm')) {
          // Check if we have dorm bed tags for this dorm - filter by accommodation_id only
          const dormItems = items?.filter(item => item.accommodation_id === acc.id) || [];
          
          console.log(`Processing ${acc.title}:`, {
            accommodation_id: acc.id,
            inventory: acc.inventory,
            dormItems: dormItems.length,
            items: dormItems
          });
          
          if (dormItems.length > 0) {
            // Use the actual dorm bed tags
            const dormItemRows = dormItems.map(item => ({
              id: item.id,
              // For dorm beds, just show "Bed X" for clarity
              label: `Bed ${item.item_id}`,
              accommodation_title: acc.title,
              accommodation_id: acc.id,
              item_id: item.id,
              is_assigned: assignedItemIds.has(item.id)
            }));
            
            // Sort by tag to maintain order
            dormItemRows.sort((a, b) => a.label.localeCompare(b.label));
            console.log(`Adding ${dormItemRows.length} dorm tag rows for ${acc.title}`);
            dormRows.push(...dormItemRows);
          } else {
            // Create automatic bed rows for unassigned dorm bookings
            // Use inventory field for bed count, fallback to parsing title
            const bedCount = acc.inventory || (acc.title.includes('6-Bed') ? 6 : acc.title.includes('3-Bed') ? 3 : 1);
            console.log(`Creating ${bedCount} automatic bed rows for ${acc.title} (no tags yet)`);
            for (let bed = 1; bed <= bedCount; bed++) {
              dormRows.push({
                id: `${acc.id}-bed-${bed}`,
                label: `${acc.title} - Bed ${bed}`,
                accommodation_title: acc.title,
                accommodation_id: acc.id,
                is_bed: true,
                bed_number: bed
              });
            }
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
          // Other limited accommodations (bell tents, tipis, etc) - use items if they exist
          const accItems = items?.filter(item => item.accommodation_id === acc.id) || [];
          
          if (accItems.length > 0) {
            // Add each item as a row with assignment status
            const itemRows = accItems.map(item => ({
              id: item.id,
              label: item.full_tag,
              accommodation_title: acc.title, // Use accommodation's title, not the view's
              accommodation_id: acc.id,
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
          
          // For ANY accommodation with inventory, ensure we have enough rows
          if (acc.inventory && acc.inventory > accItems.length) {
            console.log('Adding inventory rows for:', acc.title, {
              inventory: acc.inventory,
              existingItems: accItems.length,
              needed: acc.inventory - accItems.length
            });
            
            for (let i = accItems.length; i < acc.inventory; i++) {
              otherRows.push({
                id: `${acc.id}-inventory-${i}`,
                label: `${acc.title} #${i + 1}`,
                accommodation_title: acc.title,
                accommodation_id: acc.id,
                item_id: undefined,
                is_assigned: false
              });
            }
          }
        } else {
          // Unlimited accommodations
          // For special types, we still need to load their tags for the reassignment modal
          const accItems = items?.filter(item => item.accommodation_id === acc.id) || [];
          
          if (accItems.length > 0) {
            // Add each item as a row with assignment status
            const itemRows = accItems.map(item => ({
              id: item.id,
              label: item.full_tag,
              accommodation_title: acc.title, // ALWAYS use accommodation's title
              accommodation_id: acc.id, // Use the accommodation's ID
              item_id: item.id,
              is_assigned: assignedItemIds.has(item.id)
            }));
            
            // Sort by label only to maintain consistent order
            itemRows.sort((a, b) => a.label.localeCompare(b.label));
            
            // For special types, keep them separate so they appear at the bottom (but not tents)
            if (acc.title === 'Van Parking' || 
                acc.title === 'Staying with somebody') {
              console.log(`Adding ${itemRows.length} ${acc.title} tags to special rows:`, itemRows.map(r => ({
                label: r.label,
                item_id: r.item_id,
                accommodation_title: r.accommodation_title
              })));
              specialAccommodationRows.push(...itemRows);
            } else {
              otherRows.push(...itemRows);
            }
          }
        }
      });

      // Combine in the desired order: single rooms first, then dorms, then others (bell tents, tipis, etc), then special accommodations
      rows.push(...singleRoomRows, ...dormRows, ...otherRows, ...specialAccommodationRows);

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
      
      // Debug dorm bookings specifically
      const dormBookings = bookingsData?.filter(b => 
        b.accommodations?.title?.includes('Dorm') ||
        b.accommodation_id === 'd30c5cf7-f033-449a-8cec-176b754db7ee' || // 6-bed dorm
        b.accommodation_id === '25c2a846-926d-4ac8-9cbd-f03309883e22'    // 3-bed dorm
      );
      if (dormBookings && dormBookings.length > 0) {
        console.log('[InventoryCalendar] Dorm bookings found:', dormBookings.map(b => ({
          id: b.id,
          accommodation_id: b.accommodation_id,
          accommodation_title: b.accommodations?.title,
          check_in: b.check_in,
          check_out: b.check_out,
          guest: b.guest_email || b.user_email
        })));
      }
      
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
      
      // Log special accommodation bookings
      const stayingWithSomebody = processedData.filter(b => 
        b.accommodation_title === 'Staying with somebody'
      );
      if (stayingWithSomebody.length > 0) {
        console.log('[InventoryCalendar] Staying with somebody bookings:', stayingWithSomebody);
      }
      
      const vanParkingBookings = processedData.filter(b => 
        b.accommodation_title === 'Van Parking'
      );
      if (vanParkingBookings.length > 0) {
        console.log('[InventoryCalendar] Van Parking bookings:', vanParkingBookings.map(b => ({
          id: b.id,
          guest: b.guest_email,
          accommodation_title: b.accommodation_title,
          accommodation_item_id: b.accommodation_item_id,
          item_tag: b.item_tag,
          check_in: b.check_in,
          check_out: b.check_out
        })));
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
    
    // Debug log for unassigned bookings
    if (!booking.accommodation_item_id && 
        (booking.accommodation_title === 'Your Own Tent' || 
         booking.accommodation_title === 'Van Parking' || 
         booking.accommodation_title === 'Staying with somebody')) {
      console.log('Clicked unassigned booking:', {
        title: booking.accommodation_title,
        application_id: booking.application_id,
        user_id: booking.user_id,
        guest: booking.guest_name || booking.guest_email
      });
    }
    
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
    } else if (booking.user_id) {
      // Fallback: try to fetch by user_id if no application_id
      console.log('No application_id, trying user_id:', booking.user_id);
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
          .eq('user_id', booking.user_id)
          .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 or 1 rows
          
        if (error) throw error;
        
        if (appData) {
          setSelectedApplication(appData);
        } else {
          console.warn('No application found for user_id:', booking.user_id);
          // Could show a message to the user here
        }
      } catch (err) {
        console.error('Error fetching application by user_id:', err);
      }
    } else {
      console.warn('Booking has neither application_id nor user_id:', booking);
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

  const handleGoToToday = () => {
    const now = new Date();
    if (viewMode === 'week') {
      // Find the most recent Monday
      const dayOfWeek = now.getUTCDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday));
      setCurrentWeekStart(monday);
    } else {
      setCurrentMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    }
  };

  const saveScrollPosition = () => {
    const scrollEl = document.querySelector('.inventory-calendar-scroll');
    if (scrollEl) setScrollPosition(scrollEl.scrollTop);
  };

  return (
    <>
      <AnimatePresence mode="wait">
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
                onGoToToday={handleGoToToday}
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
      </AnimatePresence>

      {selectedApplication && (
        <ApplicationDetails
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          questions={questions}
        />
      )}
    </>
  );
}