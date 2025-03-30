import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-stone-200 mt-auto py-6">
      <div className="container mx-auto px-4 text-center text-stone-600 text-sm font-regular">
        <p>
          Questions or concerns? Email us at{' '}
          <a
            href="mailto:living@thegarden.pt"
            className="text-emerald-900 hover:text-emerald-700 underline"
          >
            living@thegarden.pt
          </a>
        </p>
        {/* You could add more footer content here later, like copyright or other links */}
      </div>
    </footer>
  );
}; 