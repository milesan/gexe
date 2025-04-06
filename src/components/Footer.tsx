import React from 'react';

interface FooterProps {
  wrapperClassName?: string;
}

export const Footer: React.FC<FooterProps> = ({ wrapperClassName }) => {
  const defaultClasses = "bg-surface/50 backdrop-blur-sm border-t border-border mt-auto py-6";
  const finalClasses = wrapperClassName ?? defaultClasses;

  return (
    <footer className={finalClasses}>
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