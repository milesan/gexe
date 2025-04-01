import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '../components/Footer';

// Basic logging for component mount
console.log('WhyPage: Component rendering');

export function WhyPage() {
  return (
    <div className="min-h-screen bg-main flex flex-col">
      <main className="flex-grow container mx-auto px-4 py-8 sm:py-12">
        <div className="bg-surface rounded-lg shadow-lg p-6 sm:p-10 max-w-3xl mx-auto border border-border">
          <h1
            className="text-3xl sm:text-4xl font-['VT323'] mb-6 text-center bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-transparent bg-clip-text animate-gradient-x"
            style={{ backgroundSize: '200% 200%' }} // Needed for animation
          >
            Why This App Exists
          </h1>

          <p className="text-secondary mb-6 text-base leading-relaxed font-regular">
            This website was painstakingly coded with love, care, and connection by members of The Garden community.
          </p>

          <p className="text-secondary mb-6 text-base leading-relaxed font-regular">
            Why? Because the old way just wasn't working. Managing the sheer volume of booking requests and inquiries became a full-time job, draining precious energy that could be better spent cultivating the community and the space itself. We were drowning in emails, and the existing platforms just didn't quite fit the unique spirit and needs of The Garden.
          </p>

          <p className="text-secondary mb-8 text-base leading-relaxed font-regular">
            So, we rolled up our sleeves. Community members poured hundreds of hours into designing and building this system, aiming to free up time and create a smoother experience for everyone wanting to connect with The Garden. It's a small testament to what we can build together.
          </p>

          <div className="text-center border-t border-border pt-8 mt-8">
            <p className="text-secondary font-medium mb-4 text-base font-regular">
              Remember the days before? The overflowing inbox...
            </p>
            <img
              src="https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/other//email-before.jpg"
              alt="A whimsical depiction of an overflowing email inbox"
              className="rounded-lg shadow-md mx-auto max-w-full h-auto border border-border"
              // Add loading="lazy" for performance if image is large
              onError={(e) => {
                console.error('WhyPage: Failed to load image', e);
                // Optionally display a placeholder or error message
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      </main>

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