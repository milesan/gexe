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
        className="fixed bottom-4 left-4 z-50 p-2 rounded-full bg-[var(--color-bg-surface)] text-secondary hover:text-primary hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring,var(--color-accent-primary))] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-offset,var(--color-bg-main))] shadow-lg border border-[var(--color-border)]"
        aria-label="Report a bug"
        title="Report an Issue or Bug"
        style={{ 
          bottom: '1rem', 
          left: '1rem',
          zIndex: 9999 
        }}
      >
        <Bug className="w-5 h-5" />
      </button>

      <BugReportModal isOpen={isModalOpen} onClose={closeModal} />
    </>
  );
} 