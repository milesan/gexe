import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { logger } from '../utils/logging';
import { supabase } from '../lib/supabase'; // Import Supabase client

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset form only when modal is closed
  useEffect(() => {
    if (!isOpen) { 
      const timer = setTimeout(() => {
        setDescription('');
        setStepsToReproduce('');
        setStatus('idle');
        setErrorMessage(null);
      }, 300); // Delay reset slightly for exit animation
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!description || status === 'submitting') return;

    setStatus('submitting');
    setErrorMessage(null);
    const submissionData = { 
      description, 
      stepsToReproduce: stepsToReproduce || null, // Send null if empty
      pageUrl: window.location.href 
    };
    logger.log('[BugReportModal] Submitting bug report:', submissionData);

    try {
      // --- Replace Placeholder with Actual API Call --- 
      const { data, error } = await supabase.functions.invoke('submit-bug-report', {
        body: submissionData,
      });

      if (error) {
        logger.error('[BugReportModal] Supabase function invocation error:', error);
        throw new Error(error.message || 'Failed to submit bug report via function.');
      }
      
      // Check the function's specific success/error response if needed
      // Example: assuming function returns { success: true/false, ... }
      if (data && data.error) { // Check for application-level errors returned by the function
        logger.error('[BugReportModal] Function returned error:', data.error);
        throw new Error(data.error || 'Submission failed.');
      }
      
      if (!data) { // Handle case where function returns no data unexpectedly
        logger.error('[BugReportModal] Function returned no data.');
        throw new Error('Received an empty response from the server.');
      }

      logger.log('[BugReportModal] Bug report submitted successfully via function:', data);
      setStatus('success');
      setTimeout(onClose, 2000); 

    } catch (error) {
      logger.error('[BugReportModal] Error submitting bug report:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred.');
    }
    // --- End API Call ---
  };

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[var(--color-overlay,rgba(0,0,0,0.7))] backdrop-blur-sm flex items-center justify-center z-[100] p-4"
              onClick={onClose} // Close on overlay click
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[var(--color-surface-modal,theme(colors.gray.800))] rounded-lg p-4 sm:p-6 max-w-lg w-full relative z-[101] max-h-[90vh] overflow-y-auto shadow-xl border border-[var(--color-border-modal,theme(colors.gray.500/0.3))] text-[var(--color-text-primary,theme(colors.white))] backdrop-blur-sm flex flex-col"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
              >
                <button
                  onClick={onClose}
                  className="absolute top-3 sm:top-4 right-3 sm:right-4 text-[var(--color-text-secondary,theme(colors.gray.400))] hover:text-[var(--color-text-primary,theme(colors.white))] disabled:opacity-50"
                  disabled={status === 'submitting'}
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-base sm:text-lg font-display text-[var(--color-text-primary,theme(colors.white))] mb-4 sm:mb-5">
                  Report an Issue
                </h3>

                {status === 'success' ? (
                  <div className="text-center p-4 bg-[var(--color-success-bg,theme(colors.green.600/0.2))] border border-[var(--color-success-border,theme(colors.green.500/0.5))] rounded-md">
                    <CheckCircle className="w-8 h-8 text-[var(--color-success-icon,theme(colors.green.400))] mx-auto mb-2" />
                    <p className="text-[var(--color-success-text,theme(colors.green.300))] font-medium font-regular">Thank you!</p>
                    <p className="text-xs text-[var(--color-text-secondary,theme(colors.gray.300))] mt-1 font-regular">Your report has been submitted.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col flex-grow space-y-4 font-regular">
                    <div>
                      <label htmlFor="description" className="block text-xs sm:text-sm font-medium text-[var(--color-text-secondary,theme(colors.gray.300))] mb-1">Description <span className="text-[var(--color-error-indicator,theme(colors.red.500))]">*</span></label>
                      <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the problem you encountered..."
                        required
                        rows={4}
                        className="w-full bg-[var(--color-input-bg,theme(colors.gray.700/0.5))] border border-[var(--color-input-border,theme(colors.gray.600))] rounded-md p-2 text-sm text-[var(--color-text-primary,theme(colors.white))] focus:ring-1 focus:ring-[var(--color-focus-ring,theme(colors.accent-primary))] focus:border-[var(--color-focus-ring,theme(colors.accent-primary))] placeholder-[var(--color-text-placeholder,theme(colors.gray.400))] disabled:opacity-70"
                        disabled={status === 'submitting'}
                      />
                    </div>
                    
                    <div>
                       <label htmlFor="stepsToReproduce" className="block text-xs sm:text-sm font-medium text-[var(--color-text-secondary,theme(colors.gray.300))] mb-1">Steps to Reproduce (Optional)</label>
                       <textarea
                         id="stepsToReproduce"
                         value={stepsToReproduce}
                         onChange={(e) => setStepsToReproduce(e.target.value)}
                         placeholder="How can we make this happen? e.g.&#10;1. Go to page X&#10;2. Click button Y&#10;3. See error Z"
                         rows={4}
                         className="w-full bg-[var(--color-input-bg,theme(colors.gray.700/0.5))] border border-[var(--color-input-border,theme(colors.gray.600))] rounded-md p-2 text-sm text-[var(--color-text-primary,theme(colors.white))] focus:ring-1 focus:ring-[var(--color-focus-ring,theme(colors.accent-primary))] focus:border-[var(--color-focus-ring,theme(colors.accent-primary))] placeholder-[var(--color-text-placeholder,theme(colors.gray.400))] disabled:opacity-70"
                         disabled={status === 'submitting'}
                       />
                    </div>

                    {status === 'error' && (
                      <div className="flex items-center p-2 text-xs sm:text-sm bg-[var(--color-error-bg,theme(colors.red.600/0.2))] border border-[var(--color-error-border,theme(colors.red.500/0.5))] rounded-md text-[var(--color-error-text,theme(colors.red.300))]">
                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="font-regular">{errorMessage || 'Submission failed. Please try again.'}</span>
                      </div>
                    )}

                    <div className="mt-auto pt-4 flex justify-end space-x-3">
                       <button 
                          type="button"
                          onClick={onClose}
                          className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md text-[var(--color-button-secondary-text,theme(colors.gray.300))] bg-[var(--color-button-secondary-bg,theme(colors.gray.600/0.5))] hover:bg-[var(--color-button-secondary-bg-hover,theme(colors.gray.600/0.8))] focus:outline-none focus:ring-2 focus:ring-[var(--color-button-secondary-focus-ring,theme(colors.gray.500))] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-offset,theme(colors.gray.800))] disabled:opacity-50 transition-colors font-regular"
                          disabled={status === 'submitting'}
                       >
                         Cancel
                       </button>
                       <button 
                          type="submit"
                          className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md text-[var(--color-button-primary-text,theme(colors.stone.800))] bg-[var(--color-button-primary-bg,theme(colors.accent-primary))] hover:bg-[var(--color-button-primary-bg-hover,theme(colors.accent-primary/0.8))] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring,theme(colors.accent-primary))] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-offset,theme(colors.gray.800))] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center font-regular"
                          disabled={!description || status === 'submitting'}
                       >
                         {status === 'submitting' ? (
                           <>
                             <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[var(--color-button-primary-text,theme(colors.stone.800))]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                             </svg>
                             Submitting...
                           </>
                         ) : (
                           'Submit Report'
                         )}
                       </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
} 