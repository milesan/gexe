import React from 'react';
import { X } from 'lucide-react';
import { Booking } from './types';

interface Props {
  bookings: Booking[];
  onSelect: (booking: Booking) => void;
  onClose: () => void;
  title: string;
}

export function BookingSelectionModal({ bookings, onSelect, onClose, title }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--color-bg-surface-hover)] rounded"
          >
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <div className="space-y-2">
          {bookings.map(booking => (
            <button
              key={booking.id}
              onClick={() => onSelect(booking)}
              className="w-full p-3 text-left bg-[var(--color-bg-surface-hover)] hover:bg-[var(--color-bg-surface-hover-2)] 
                       rounded-lg transition-colors border border-[var(--color-border)]"
            >
              <div className="font-medium text-[var(--color-text-primary)]">
                {booking.first_name || booking.guest_name || booking.guest_email || 'Guest'}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                {booking.accommodation_title}
                {booking.item_tag && ` - ${booking.item_tag}`}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}