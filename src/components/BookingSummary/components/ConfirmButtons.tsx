import React from 'react';

interface ConfirmButtonsProps {
  isBooking: boolean;
  selectedAccommodation: any | null;
  selectedWeeks: any[];
  finalAmountAfterCredits: number;
  creditsToUse: number;
  isAdmin: boolean;
  permissionsLoading: boolean;
  onConfirm: () => void;
  onAdminConfirm: () => void;
}

export function ConfirmButtons({
  isBooking,
  selectedAccommodation,
  selectedWeeks,
  finalAmountAfterCredits,
  creditsToUse,
  isAdmin,
  permissionsLoading,
  onConfirm,
  onAdminConfirm
}: ConfirmButtonsProps) {
  return (
    <div className="mt-6 font-mono sm:mt-8">
      <button
        onClick={onConfirm}
        disabled={isBooking || !selectedAccommodation || selectedWeeks.length === 0}
        className={`w-full flex items-center justify-center pixel-corners--wrapper relative overflow-hidden px-6 py-2.5 sm:py-3 text-lg font-medium rounded-sm transition-colors duration-200
          ${
            isBooking || !selectedAccommodation || selectedWeeks.length === 0
              ? 'bg-transparent text-shade-3 cursor-not-allowed'
              : 'text-stone-800 bg-accent-primary hover:bg-accent-secondary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring,var(--color-accent-primary))] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-offset,var(--color-bg-main))]'
          }`}
      >
        <span className="pixel-corners--content 2xl:text-2xl">
          {isBooking ? 'PROCESSING...' : finalAmountAfterCredits === 0 && creditsToUse > 0 ? 'CONFIRM (CREDITS ONLY)' : 'CONFIRM & DONATE'}
          
        </span>
      </button>
      
      {!permissionsLoading && isAdmin && (
        <button
          onClick={onAdminConfirm}
          disabled={isBooking || !selectedAccommodation || selectedWeeks.length === 0}
          className={`w-full mt-3 flex items-center justify-center pixel-corners--wrapper relative overflow-hidden px-6 py-2.5 sm:py-3 text-lg font-medium rounded-sm transition-colors duration-200
            ${isBooking || !selectedAccommodation || selectedWeeks.length === 0
                ? 'bg-transparent text-shade-3 cursor-not-allowed'
                : 'bg-secondary-muted text-white hover:bg-secondary-muted-hover focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring,var(--color-accent-primary))] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-offset,var(--color-bg-main))]'
            }`}
        >
          <span className="pixel-corners--content 2xl:text-2xl">
             {isBooking ? 'CONFIRMING...' : <span>Admin Confirm<br />(No Payment)</span>}
          </span>
        </button>
      )}
    </div>
  );
}