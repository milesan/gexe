import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Accommodation } from '../../../types';

interface AccommodationSectionProps {
  selectedAccommodation: Accommodation;
  onClearAccommodation: () => void;
}

export function AccommodationSection({ selectedAccommodation, onClearAccommodation }: AccommodationSectionProps) {
  return (
    <motion.div 
      className="relative mt-4" /* Reduced margin */
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Middle div handles visuals - REMOVED PADDING */}
      <div className="relative rounded-sm shadow-sm bg-surface overflow-hidden p-4"> 
        {/* Inner Blur Layer */}
        <div className="absolute inset-0 -z-10 backdrop-blur-sm bg-surface/50 rounded-sm"></div>
        
        {/* Clear Button (relative to middle div) */}
        <button
          onClick={onClearAccommodation}
          className="absolute top-2 right-2 p-1.5 text-accent-primary hover:text-accent-secondary hover:bg-accent-muted rounded-full transition-colors z-20" /* Updated styles and position */
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Clear Selected Accommodation</span>
        </button>

        {/* Content Wrapper (maybe add relative z-10 if needed) */} 
        <div className="relative z-10 space-y-2"> 
            {/* Keep flex justify-between for button placement, remove mb-4 */}
            {/* Heading remains as is */}
            <h3 className="font-lettra-bold text-shade-2 text-xs">
              THY QUARTERS
            </h3>
            {/* REMOVE intermediate divs and padding/margin */}
            {/* Add block to ensure span takes up vertical space */}
            <span className="text-primary font-display text-2xl block"> 
                {selectedAccommodation.title === 'Van Parking' || 
                selectedAccommodation.title === 'Your Own Tent' || 
                selectedAccommodation.title === 'Staying with somebody' || 
                selectedAccommodation.title === 'The Hearth' 
                ? selectedAccommodation.title
                : `The ${selectedAccommodation.title}`}
            </span>
        </div>
      </div>
    </motion.div>
  );
}