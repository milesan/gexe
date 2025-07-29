import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, MapPin, Users, ArrowLeft, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Fireflies, FireflyPresets } from '../components/Fireflies';
import { FireflyPortal } from '../components/FireflyPortal';

export function ConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const booking = location.state?.booking;
  const [isPolicyOpen, setIsPolicyOpen] = React.useState(false);

  console.log('[ConfirmationPage] Component rendered with:', {
    pathname: location.pathname,
    hasBooking: !!booking,
    bookingData: booking,
    locationState: location.state
  });

  React.useEffect(() => {
    console.log('[ConfirmationPage] useEffect - checking booking data:', { hasBooking: !!booking });
    // If user tries to access confirmation page directly without booking data
    if (!booking) {
      console.log('[ConfirmationPage] No booking data found, redirecting to /my-bookings');
      navigate('/my-bookings');
    }
  }, [booking, navigate]);

  // Handle back navigation
  React.useEffect(() => {
    const handleNavigation = (e: PopStateEvent) => {
      console.log('[ConfirmationPage] popstate event fired:', {
        hasBooking: !!booking,
        currentPath: window.location.pathname,
        event: e
      });
      // Only redirect if there's no booking data (user accessed page directly)
      if (!booking) {
        console.log('[ConfirmationPage] No booking data on popstate, redirecting to /my-bookings');
        navigate('/my-bookings');
      } else {
        console.log('[ConfirmationPage] Booking data exists on popstate, allowing navigation');
      }
    };

    console.log('[ConfirmationPage] Adding popstate event listener');
    window.addEventListener('popstate', handleNavigation);
    return () => {
      console.log('[ConfirmationPage] Removing popstate event listener');
      window.removeEventListener('popstate', handleNavigation);
    };
  }, [booking, navigate]);

  // Add a general navigation listener to see all navigation attempts
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('[ConfirmationPage] beforeunload event fired');
    };

    const handleNavigationStart = () => {
      console.log('[ConfirmationPage] Navigation starting to:', window.location.pathname);
    };

    console.log('[ConfirmationPage] Adding navigation event listeners');
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handleNavigationStart);
    
    return () => {
      console.log('[ConfirmationPage] Removing navigation event listeners');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handleNavigationStart);
    };
  }, []);

  if (!booking) {
    console.log('[ConfirmationPage] No booking data, returning null');
    return null;
  }

  return (
    <div className="flex items-center justify-center p-4">
      <FireflyPortal />
      {/* Add subtle fireflies in the background */}
      <Fireflies 
        {...FireflyPresets.subtle}
        count={20}
        className="opacity-60"
      />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full rounded-sm shadow-sm border border-border overflow-hidden bg-[var(--color-bg-surface)]"
      >
        <div className="p-8 text-center border-b border-border">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </motion.div>
          
          <h1 className="text-3xl font-display font-light text-text-primary mb-2">
            Booking Confirmed
          </h1>
          <p className="text-text-secondary font-mono">
            The Existential Residencies await
          </p>
          <p className="text-text-secondary/80 font-mono text-sm mt-2">
            A confirmation email has been sent to your registered email address
          </p>
        </div>

        <div className="p-8 space-y-6">
          {/* Show manual creation message if present */}
          {booking.isPendingManualCreation && booking.manualCreationMessage && (
            <div className="bg-amber-900/20 p-4 rounded-sm border border-amber-900/30 mb-6">
              <p className="text-amber-300 font-mono text-sm">
                {booking.manualCreationMessage}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-text-secondary">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-mono">Check-in</span>
              </div>
              <p className="font-mono text-xl text-text-primary">
                {formatInTimeZone(new Date(booking.checkIn), 'UTC', 'EEEE, MMMM d')}
              </p>
              <p className="text-sm font-mono text-emerald-400">
                Available from 2-5PM
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-text-secondary">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-mono">Check-out</span>
              </div>
              <p className="font-mono text-xl text-text-primary">
                {formatInTimeZone(new Date(booking.checkOut), 'UTC', 'EEEE, MMMM d')}
              </p>
              <p className="text-sm font-mono text-emerald-400">
                By 11AM
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-text-secondary">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-mono">Accommodation</span>
              </div>
              <p className="font-mono text-xl text-text-primary">
                {booking.accommodation}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-text-secondary">
                <Users className="w-4 h-4" />
                <span className="text-sm font-mono">Guests</span>
              </div>
              <p className="font-mono text-xl text-text-primary">
                1 Person
              </p>
            </div>
          </div>

          <div className="bg-amber-900/20 p-4 rounded-sm border border-amber-900/30 my-6">
            <p className="text-amber-300 text-center flex items-center justify-center font-mono text-sm">
              To ensure a smooth arrival, please respect the check-in window (2PM-5PM) and check-out time (11AM)
            </p>
          </div>

          <div className="border-t border-border pt-6">
            <div className="flex justify-between items-center text-lg font-mono text-text-primary">
              <span>Total Amount Donated</span>
              <span>€{booking.totalPrice}</span>
            </div>
          </div>

          <div className="bg-emerald-900/20 p-6 rounded-sm space-y-4">
            <h3 className="font-mono text-lg text-emerald-200">
              Tidbits
            </h3>
            <ul className="space-y-2 text-sm text-emerald-300 font-mono">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">❧</span>
                <span>This is a co-created experience </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">❧</span>
                <span>The Garden is a strictly smoke & alcohol-free space</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">❧</span>
                <span>Breakfast, lunch & dinner included Monday-Friday</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-900/20 border border-slate-800 rounded-sm overflow-hidden">
            <button
              onClick={() => setIsPolicyOpen(!isPolicyOpen)}
              className="w-full p-4 flex items-center justify-between text-slate-300 hover:bg-slate-900/30 transition-colors"
            >
              <span className="font-mono text-lg">Cancellation Policy</span>
              {isPolicyOpen ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
            
            {isPolicyOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-slate-800"
              >
                <div className="p-4 space-y-4">
                  <p className="text-slate-400 text-sm font-mono leading-relaxed">
                    As a non-profit association, your contributions are considered donations that directly support our mission and the operations of this space. While donations are typically non-refundable, we understand that plans can change and offer the following flexibility:
                  </p>
                  
                  <ol className="space-y-3 text-sm text-slate-300 font-mono">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold min-w-[1.2rem]">1.</span>
                      <div>
                        <span className="font-semibold">Guests with independent accommodations (van/camping):</span>
                        <br />Always eligible for 85% refund or 100% credit, regardless of timing.
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold min-w-[1.2rem]">2.</span>
                      <div>
                        <span className="font-semibold">More than 30 days before arrival:</span>
                        <br />We can offer a 85% refund of your donation or 100% credit for future use within 12 months.
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold min-w-[1.2rem]">3.</span>
                      <div>
                        <span className="font-semibold">15 to 30 days before arrival:</span>
                        <br />We can offer a 50%-60% refund of your donation or 75% credit for future use within 12 months.
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold min-w-[1.2rem]">4.</span>
                      <div>
                        <span className="font-semibold">Less than 15 days before arrival:</span>
                        <br />Donations are non-refundable at this stage, but we can offer a 50% credit for future use within 12 months.
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold min-w-[1.2rem]">5.</span>
                      <div>
                        <span className="font-semibold">Special circumstances (force majeure, injury, or accident):</span>
                        <br />With valid documentation:
                        <ul className="mt-1 ml-4 space-y-1">
                          <li>• More than 15 days before arrival: 85% refund of donation or 100% credit.</li>
                          <li>• 15 days or less before arrival: 75% credit.</li>
                        </ul>
                      </div>
                    </li>
                  </ol>
                </div>
              </motion.div>
            )}
          </div>

          <a 
            href="https://gardening.notion.site/Welcome-to-The-Garden-2684f446b48e4b43b3f003d7fca33664?pvs=4"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-6 rounded-sm transition-colors text-center font-mono text-lg flex items-center justify-center gap-2"
          >
            Welcome Guide
            <ExternalLink className="w-4 h-4" />
          </a>

          <Link 
            to="/my-bookings"
            className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono text-sm">View All Bookings</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
