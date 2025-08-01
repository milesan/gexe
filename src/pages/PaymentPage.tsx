/*import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, MapPin, Users, ArrowLeft, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { StripeCheckoutForm } from '../components/StripeCheckoutForm';
import { supabase } from '../lib/supabase';

export function PaymentPage() {
  console.log('[Payment Page] Component mounted');

  const location = useLocation();
  const navigate = useNavigate();
  const booking = location.state?.booking;

  const [authToken, setAuthToken] = useState('');

  useEffect(() => {
    console.log('[Payment Page] Initial booking data:', {
      exists: !!booking,
      checkIn: booking?.checkIn,
      checkOut: booking?.checkOut,
      accommodation: booking?.accommodation,
      guests: booking?.guests,
      totalPrice: booking?.totalPrice
    });
  }, [booking]);

  useEffect(() => {
    console.log('[Payment Page] Getting Supabase session');
    supabase.auth.getSession().then(res => {
      const authToken = res?.data?.session?.access_token;
      console.log('[Payment Page] Auth token retrieved:', !!authToken);
      if(authToken && authToken != ''){
        setAuthToken(authToken)
      }
    }).catch(error => {
      console.error('[Payment Page] Error getting auth session:', error);
    });
  }, []);

  useEffect(() => {
    // If user tries to access confirmation page directly without booking data
    if (!booking) {
      console.warn('[Payment Page] No booking data found, redirecting to /my-bookings');
      navigate('/my-bookings');
    }
  }, [booking, navigate]);

  // Handle back navigation
  useEffect(() => {
    console.log('[Payment Page] Setting up back navigation handler');
    const handleNavigation = (e: PopStateEvent) => {
      console.log('[Payment Page] Back navigation detected, redirecting to /my-bookings');
      navigate('/my-bookings');
    };

    window.addEventListener('popstate', handleNavigation);
    return () => {
      console.log('[Payment Page] Cleaning up back navigation handler');
      window.removeEventListener('popstate', handleNavigation);
    }
  }, [navigate]);

  const checkInDateString = format(new Date(booking?.checkIn), 'EEEE, MMMM d');
  const checkOutDateString = format(new Date(booking?.checkOut), 'EEEE, MMMM d');
  const accommodationString = booking?.accommodation;
  const totalPriceString = booking?.totalPrice;
  const descriptionString = `${accommodationString} from ${checkInDateString} to ${checkOutDateString}`;

  console.log('[Payment Page] Formatted booking details:', {
    checkInDate: checkInDateString,
    checkOutDate: checkOutDateString,
    accommodation: accommodationString,
    totalPrice: totalPriceString,
    description: descriptionString
  });

  if (!booking) {
    console.log('[Payment Page] Rendering null due to missing booking data');
    return null;
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white rounded-sm shadow-sm border border-stone-200 overflow-hidden"
      >

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-stone-600">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Check-in</span>
              </div>
              <p className="font-display text-xl">
                {checkInDateString}
              </p>
              <p className="text-sm text-emerald-600">
                Available from 2-5PM
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-stone-600">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Check-out</span>
              </div>
              <p className="font-display text-xl">
              {checkOutDateString}
              </p>
              <p className="text-sm text-emerald-600">
                By 11PM Noon
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-stone-600">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Accommodation</span>
              </div>
              <p className="font-display text-xl">
                {accommodationString}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-stone-600">
                <Users className="w-4 h-4" />
                <span className="text-sm">Guests</span>
              </div>
              <p className="font-display text-xl">
                {booking.guests} {booking.guests === 1 ? 'Person' : 'People'}
              </p>
            </div>
          </div>

          <div className="border-t border-stone-200 pt-6">
            <div className="flex justify-between items-center text-lg font-display">
              <span>Total Amount Due</span>
              <span>€{totalPriceString}</span>
            </div>
          </div>

          {authToken && 
            <StripeCheckoutForm authToken={authToken} total={parseFloat(totalPriceString)} description={descriptionString} />
          }
          
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>View Calendar</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}*/