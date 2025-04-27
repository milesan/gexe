import React from 'react';
import { format, parseISO } from 'date-fns';
import { bookingService } from '../services/BookingService';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { useSession } from '../hooks/useSession';
import type { Booking } from '../types';

export function MyBookings() {
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [enlargedImageUrl, setEnlargedImageUrl] = React.useState<string | null>(null);
  const session = useSession();

  React.useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await bookingService.getUserBookings();
      setBookings(data || []);
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-error-muted text-error p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-8">
      <div className="grid grid-cols-1">
        <div className="px-3 xs:px-4 sm:px-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl font-display font-light text-primary mb-2">My Account</h1>
              <div className="text-primary">
                <p className="font-mono">{session?.user?.email}</p>
              </div>
            </div>
          </div>
          
          {bookings.length === 0 ? (
            <div className="text-center font-mono text-primary">
              No bookings found. Book your first stay!
            </div>
          ) : (
            <div className="space-y-6">
              {bookings.map((booking) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface p-6 rounded-sm shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-display font-light mb-2 text-primary">
                        {booking.accommodation?.title || 'Accommodation'}
                      </h3>
                      <div className="space-y-1 text-sm font-mono">
                        <p>
                          <span className="text-primary">Check-in:</span>{' '}
                          <span className="text-primary">{format(parseISO(booking.check_in), 'PPP')}</span>
                        </p>
                        <p>
                          <span className="text-primary">Check-out:</span>{' '}
                          <span className="text-primary">{format(parseISO(booking.check_out), 'PPP')}</span>
                        </p>
                        <p>
                          <span className="text-primary">Total Price:</span>{' '}
                          <span className="text-primary">€{booking.total_price}</span>
                        </p>
                        <a 
                          href="https://gardening.notion.site/Welcome-to-The-Garden-2684f446b48e4b43b3f003d7fca33664?pvs=4"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent-primary hover:text-accent-hover transition-colors mt-2"
                        >
                          Welcome Guide
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    {booking.accommodation?.image_url && (
                      <button
                        onClick={() => setEnlargedImageUrl(booking.accommodation?.image_url || null)}
                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 rounded-lg transition-opacity hover:opacity-80"
                      >
                        <img
                          src={booking.accommodation.image_url}
                          alt={booking.accommodation.title}
                          className="w-32 h-32 object-cover rounded-lg cursor-pointer"
                        />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {enlargedImageUrl && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setEnlargedImageUrl(null)}
        >
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={enlargedImageUrl}
              alt="Enlarged booking accommodation"
              className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setEnlargedImageUrl(null)}
              className="absolute -top-2 -right-2 bg-surface rounded-full p-1 text-secondary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
              aria-label="Close enlarged image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
