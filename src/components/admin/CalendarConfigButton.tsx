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
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        title="Calendar Settings"
      >
        <Settings className="h-5 w-5" />
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