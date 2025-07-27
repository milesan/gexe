import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '../components/Footer';

export function WhyPage() {
  useEffect(() => {
    console.log('WhyPage: Component rendering');
  }, []);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  
  return (
    <div className="min-h-screen bg-main flex flex-col">
      <main className="flex-grow container mx-auto px-4 py-8 sm:py-12">
        <div className="bg-surface rounded-sm shadow-lg p-6 sm:p-10 max-w-3xl mx-auto border border-border">
          <h1
            className="text-3xl sm:text-4xl font-['VT323'] mb-6 text-center text-white"
          >
            Why This App Exists
          </h1>

          <p className="text-secondary mb-6 text-base leading-relaxed font-mono">
            This website was painstakingly coded with love, care, and connection by members of The Garden community.
          </p>

          <p className="text-secondary mb-6 text-base leading-relaxed font-mono">
            Why? Because the old way just wasn't working. Managing the sheer volume of booking requests and inquiries became a full-time job, draining precious energy that could be better spent cultivating the community and the space itself. We were drowning in emails, and the existing platforms just didn't quite fit the unique spirit and needs of The Garden.
          </p>

          <p className="text-secondary mb-8 text-base leading-relaxed font-mono">
            So, we rolled up our sleeves. Community members poured hundreds of hours into designing and building this system, aiming to free up time and create a smoother experience for everyone wanting to connect with The Garden. It's a small testament to what we can build together.
          </p>

          <div className="text-center border-t border-border pt-8 mt-8">
            <p className="text-secondary font-medium mb-4 text-base font-mono">
              Remember the days before? The overflowing inbox...
            </p>
            <button
              onClick={() => setEnlargedImageUrl("https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/other//email-before.jpg")}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 rounded-sm transition-opacity hover:opacity-80"
            >
              <img
                src="https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/other//email-before.jpg"
                alt="A whimsical depiction of an overflowing email inbox"
                className="rounded-sm shadow-md mx-auto max-w-full h-auto border border-border cursor-pointer"
                // Add loading="lazy" for performance if image is large
                onError={(e) => {
                  console.error('WhyPage: Failed to load image', e);
                  // Optionally display a placeholder or error message
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </button>
          </div>
        </div>
      </main>

      {/* Image Modal - Matched with MyBookings.tsx */}
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
              alt="Enlarged image"
              className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-sm shadow-2xl"
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

      {/* Add CSS for gradient animation */}
      {/* Tailwind handles the animation via animate-gradient-x if configured */}
      {/* Otherwise, ensure these keyframes are defined globally or scoped */}
      <style>
        {`
          @keyframes gradient-x {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-gradient-x {
            /* background-size is applied inline */
            animation: gradient-x 5s ease infinite;
          }
        `}
      </style>
    </div>
  );
}

// Make sure Footer component exists and path is correct
// Make sure Tailwind CSS is configured to include animate-gradient-x or the keyframes are loaded
