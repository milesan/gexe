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
        className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        title="Calendar Settings"
      >
        <Settings className="h-4 w-4 mr-1.5" />
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