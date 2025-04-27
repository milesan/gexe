import React from 'react';
// Removed non-existent logger import
// import { log } from '../utils/logger';

interface InfoBoxProps {
  children: React.ReactNode;
  className?: string; // Allow additional classes like padding overrides
}

/**
 * A reusable component to display informational content within a styled box.
 * Applies consistent background, border, and rounding.
 */
export const InfoBox: React.FC<InfoBoxProps> = ({ children, className = '' }) => {
  // Define base styles for the info box container
  // Consistent padding (p-4) is applied here, but can be overridden via className prop if needed
  const baseClasses = 'bg-surface-dark rounded-sm p-4';
  
  // Combine base styles with any additional classes passed via props
  const combinedClasses = `${baseClasses} ${className}`.trim();

  // Using console.log instead of a dedicated logger for now
  console.log(`Rendering InfoBox with classes: ${combinedClasses}`);

  return (
    <div className={combinedClasses}>
      {children}
    </div>
  );
}; 