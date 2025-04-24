import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, MapPin, Users, ArrowLeft, ExternalLink } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export function ConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const booking = location.state?.booking;

  React.useEffect(() => {
    // If user tries to access confirmation page directly without booking data
    if (!booking) {
      navigate('/my-bookings');
    }
  }, [booking, navigate]);

  // Handle back navigation
  React.useEffect(() => {
    const handleNavigation = (e: PopStateEvent) => {
      navigate('/my-bookings');
    };

    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, [navigate]);

  if (!booking) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-bg-surface rounded-xl shadow-sm border border-border overflow-hidden"
      >
        <div className="p-8 text-center border-b border-border">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </motion.div>
          
          <h1 className="text-3xl font-display font-light text-text-primary mb-2">
            Booking Confirmed
          </h1>
          <p className="text-text-secondary font-mono">
            Your journey at The Garden awaits
          </p>
          <p className="text-text-secondary/80 font-mono text-sm mt-2">
            A confirmation email has been sent to your registered email address
          </p>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-text-secondary">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-mono">Check-in</span>
              </div>
              <p className="font-mono text-xl text-text-primary">
                {formatInTimeZone(new Date(booking.checkIn), 'UTC', 'EEEE, MMMM d')}
              </p>
              <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
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
              <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
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

          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-900/30 my-6">
            <p className="text-amber-800 dark:text-amber-300 text-center flex items-center justify-center font-mono text-sm">
              To ensure a smooth arrival, please respect the check-in window (2PM-5PM) and check-out time (11AM)
            </p>
          </div>

          <div className="border-t border-border pt-6">
            <div className="flex justify-between items-center text-lg font-mono text-text-primary">
              <span>Total Amount Paid</span>
              <span>€{booking.totalPrice}</span>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-lg space-y-4">
            <h3 className="font-mono text-lg text-emerald-900 dark:text-emerald-200">
              Tidbits
            </h3>
            <ul className="space-y-2 text-sm text-emerald-800 dark:text-emerald-300 font-mono">
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 dark:text-emerald-400 mt-1">❧</span>
                <span>This is a co-created experience. </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 dark:text-emerald-400 mt-1">❧</span>
                <span>The Garden is a strictly smoke & alcohol-free space</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 dark:text-emerald-400 mt-1">❧</span>
                <span>Breakfast, lunch & dinner included Monday-Friday</span>
              </li>
            </ul>
          </div>

          <a 
            href="https://gardening.notion.site/Welcome-to-The-Garden-2684f446b48e4b43b3f003d7fca33664?pvs=4"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white py-3 px-6 rounded-lg transition-colors text-center font-mono text-lg flex items-center justify-center gap-2"
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
