import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { CalendarConfigModal } from './CalendarConfigModal';

interface Props {
  onConfigChanged?: () => void;
}

export function CalendarConfigButton({ onConfigChanged }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-1.5 xs:gap-2 px-3 xs:px-4 py-1.5 xs:py-2 rounded-sm text-sm font-medium font-mono transition-colors duration-200 bg-[var(--color-button-secondary-bg)] text-primary hover:bg-[var(--color-button-secondary-bg-hover)] border border-border"
        title="Calendar Settings"
      >
        <Settings className="h-4 w-4 xs:h-5 xs:w-5" />
        <span>Calendar Settings</span>
      </button>
      
      <CalendarConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={onConfigChanged}
      />
    </>
  );
} 
