import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-surface border-t border-color mt-auto py-6">
      <div className="container mx-auto px-4 text-center text-secondary text-sm font-regular">
        <p>
          Questions or concerns? Email us at{' '}
          <a
            href="mailto:living@thegarden.pt"
            className="text-accent-primary hover:text-accent-hover underline"
          >
            living@thegarden.pt
          </a>
        </p>
        {/* You could add more footer content here later, like copyright or other links */}
      </div>
    </footer>
  );
}; 