import React, { useState } from 'react';
import { Bug } from 'lucide-react'; // Or your preferred icon library
import { BugReportModal } from './BugReportModal'; 
import { logger } from '../utils/logging'; // Fixed path

export function BugReportFAB() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => {
    logger.log('[BugReportFAB] Opening bug report modal.');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    logger.log('[BugReportFAB] Closing bug report modal.');
    setIsModalOpen(false);
  };

  return (
    <>
      <button
        onClick={openModal}
        className="fixed bottom-4 left-4 border-2 border-[var(--color-text-primary,theme(colors.gray.100))] text-[var(--color-text-primary,theme(colors.gray.100))] rounded-full p-2.5 shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring,var(--color-accent-primary))] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-offset,theme(colors.gray.800))] transition-all hover:bg-[var(--color-primary-hover-faint,color-mix(in_srgb,_theme(colors.gray.100)_10%,_transparent))] z-50"
        aria-label="Report a bug"
        title="Report an Issue or Bug"
      >
        <Bug className="w-5 h-5" />
      </button>

      <BugReportModal isOpen={isModalOpen} onClose={closeModal} />
    </>
  );
} 