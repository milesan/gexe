import React from 'react';
import { X } from 'lucide-react';
import type { AvailabilityStatus } from '../types/availability';

interface StatusModalProps {
  onClose: () => void;
  onSave: (status: AvailabilityStatus) => void;
  currentStatus?: AvailabilityStatus;
}

export function StatusModal({ onClose, onSave, currentStatus }: StatusModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-sm w-full max-w-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-primary">Set Availability Status</h3>
          <button onClick={onClose} className="text-secondary hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => onSave('AVAILABLE')}
            className={`w-full p-3 rounded-sm flex items-center justify-between ${
              currentStatus === 'AVAILABLE'
                ? 'bg-green-100 border-2 border-green-500'
                : 'bg-surface border border-color hover:bg-green-50'
            }`}
          >
            <span className="font-medium text-primary">Available</span>
            <div className="w-24 h-6 rounded bg-gradient-to-r from-green-500 to-blue-500"></div>
          </button>
          <button
            onClick={() => onSave('HOLD')}
            className={`w-full p-3 rounded-sm flex items-center justify-between ${
              currentStatus === 'HOLD'
                ? 'bg-yellow-100 border-2 border-yellow-500'
                : 'bg-surface border border-color hover:bg-yellow-50'
            }`}
          >
            <span className="font-medium text-primary">Hold</span>
            <div className="w-24 h-6 rounded bg-gradient-to-r from-yellow-500 to-blue-500"></div>
          </button>
          <button
            onClick={() => onSave('BOOKED')}
            className={`w-full p-3 rounded-sm flex items-center justify-between ${
              currentStatus === 'BOOKED'
                ? 'bg-red-100 border-2 border-red-500'
                : 'bg-surface border border-color hover:bg-red-50'
            }`}
          >
            <span className="font-medium text-primary">Booked</span>
            <div className="w-24 h-6 rounded bg-gradient-to-r from-red-500 to-blue-500"></div>
          </button>
        </div>
      </div>
    </div>
  );
}