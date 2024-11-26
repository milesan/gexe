import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Accommodation = Database['public']['Tables']['accommodations']['Row'];

export async function createBooking(
  accommodationId: string,
  checkIn: Date,
  checkOut: Date,
  totalPrice: number,
  doBooking?: boolean
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    // Get accommodation details
    const { data: accommodation, error: accError } = await supabase
      .from('accommodations')
      .select(`
        *,
        beds:parent_accommodation_id (
          id,
          title,
          inventory_count
        )
      `)
      .eq('id', accommodationId)
      .single();

    if (accError) throw accError;
    if (!accommodation) throw new Error('Accommodation not found');

    // For dorms, find an available bed
    if (accommodation.title.includes('Dorm')) {
      // Get all bookings for this dorm during the date range
      const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          accommodation_id,
          check_in,
          check_out
        `)
        .eq('status', 'confirmed')
        .or(`check_in.lte.${checkOut.toISOString()},check_out.gt.${checkIn.toISOString()}`);

      if (bookingsError) throw bookingsError;

      // Get all bed units for this dorm
      const { data: bedUnits, error: bedsError } = await supabase
        .from('accommodations')
        .select('id')
        .eq('parent_accommodation_id', accommodationId);

      if (bedsError) throw bedsError;
      if (!bedUnits?.length) throw new Error('No bed units found');

      // Find which beds are booked for each day
      const bookedBeds = new Set<string>();
      existingBookings?.forEach(booking => {
        const bookingStart = new Date(booking.check_in);
        const bookingEnd = new Date(booking.check_out);
        
        if (bookingStart < checkOut && bookingEnd > checkIn) {
          bookedBeds.add(booking.accommodation_id);
        }
      });

      // Find an available bed
      const availableBed = bedUnits.find(bed => !bookedBeds.has(bed.id));
      if (!availableBed) throw new Error('No beds available for the selected dates');

      if(doBooking){
        // Create booking for the specific bed
        const { data: booking, error: createError } = await supabase
          .from('bookings')
          .insert({
            accommodation_id: availableBed.id,
            user_id: user.id,
            check_in: checkIn.toISOString(),
            check_out: checkOut.toISOString(),
            total_price: totalPrice,
            status: 'confirmed'
          })
          .select()
          .single();

        if (createError) throw createError;      
        return booking;
      }
    } else {
      // For regular accommodations, check if already booked
      const { data: existingBooking, error: bookingError } = await supabase
        .from('bookings')
        .select('id')
        .eq('accommodation_id', accommodationId)
        .eq('status', 'confirmed')
        .or(`check_in.lte.${checkOut.toISOString()},check_out.gt.${checkIn.toISOString()}`)
        .maybeSingle();

      if (bookingError) throw bookingError;
      if (existingBooking) throw new Error('Accommodation already booked for these dates');

      if(doBooking){
        // Create the booking
        const { data: booking, error: createError } = await supabase
        .from('bookings')
        .insert({
          accommodation_id: accommodationId,
          user_id: user.id,
          check_in: checkIn.toISOString(),
          check_out: checkOut.toISOString(),
          total_price: totalPrice,
          status: 'confirmed'
        })
        .select()
        .single();

        if (createError) throw createError;
        return booking;
      }
    }
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
}

export async function getUserBookings() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        *,
        accommodations!inner (
          id,
          title,
          location,
          image_url,
          price,
          parent_accommodation_id,
          parent:parent_accommodation_id (
            id,
            title,
            location,
            image_url
          )
        )
      `)
      .eq('user_id', user.id)
      .order('check_in', { ascending: true });

    if (error) throw error;

    // Process the data to use parent accommodation details for dorm beds
    const processedData = data?.map(booking => {
      if (booking.accommodations?.parent) {
        return {
          ...booking,
          accommodations: {
            ...booking.accommodations.parent,
            price: booking.accommodations.price
          }
        };
      }
      return booking;
    });

    return processedData;
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    throw error;
  }
}