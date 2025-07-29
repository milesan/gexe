import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Upload, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { logger } from '../utils/logging';
import { supabase } from '../lib/supabase';

interface UploadedFileData {
  url: string;
  fileName: string;
}

interface UploadingFileData {
  fileName: string;
  originalName: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

const IMAGE_LIMIT = 5;
const MAX_FILE_SIZE_MB = 5;

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileData[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFileData[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setDescription('');
        setStepsToReproduce('');
        setStatus('idle');
        setErrorMessage(null);
        setUploadedFiles([]);
        setUploadingFiles([]);
        setUploadError(null);
        setIsDeleting(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleFileUpload = async (files: File[]) => {
    setUploadError(null);

    const currentFileCount = uploadedFiles.length + uploadingFiles.length;
    const filesToUpload = files.slice(0, IMAGE_LIMIT - currentFileCount);

    if (files.length > filesToUpload.length && currentFileCount < IMAGE_LIMIT) {
        const limitMessage = `You can only upload up to ${IMAGE_LIMIT} images in total. ${filesToUpload.length} more allowed.`;
        setUploadError(limitMessage);
        logger.warn('[BugReportModal] Upload limit check:', {
            limit: IMAGE_LIMIT,
            current: currentFileCount,
            attempted: files.length,
            allowedNow: filesToUpload.length,
            message: limitMessage
        });
    } else if (filesToUpload.length === 0 && files.length > 0) {
        const limitMessage = `You have already reached the limit of ${IMAGE_LIMIT} images.`;
        setUploadError(limitMessage);
        logger.warn('[BugReportModal] Upload skipped: Limit already reached.', { limit: IMAGE_LIMIT, current: currentFileCount });
        return;
    }

    if (filesToUpload.length === 0) {
        logger.log('[BugReportModal] No files selected or limit reached.');
        return;
    }

    logger.log('[BugReportModal] Starting file upload:', {
      numberOfFiles: filesToUpload.length,
      uploadingFileNames: filesToUpload.map(f => f.name),
      currentFileCount: currentFileCount
    });

    // Add uploading placeholders immediately
    const newUploadingFiles: UploadingFileData[] = filesToUpload.map(file => ({
      fileName: `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/_{2,}/g, '_')}`,
      originalName: file.name,
      progress: 0,
      status: 'uploading'
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    try {
      const uploadPromises = filesToUpload.map(async (file, index) => {
        const uploadingFile = newUploadingFiles[index];
        
        if (!file.type.startsWith('image/')) {
          logger.warn('[BugReportModal] Skipping non-image file:', file.name, file.type);
          throw new Error(`Skipped '${file.name}': Only image files are allowed.`);
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          logger.warn('[BugReportModal] Skipping oversized file:', file.name, file.size);
          throw new Error(`Skipped '${file.name}': File size must be less than ${MAX_FILE_SIZE_MB}MB.`);
        }

        const safeFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/_{2,}/g, '_');
        const fileName = `${Date.now()}-${safeFileName}`;
        logger.log('[BugReportModal] Uploading to storage:', { bucket: 'bug-report-attachments', fileName });

        // Update progress for this specific file
        const updateProgress = (progress: number) => {
          setUploadingFiles(prev => prev.map(f => 
            f.fileName === uploadingFile.fileName 
              ? { ...f, progress } 
              : f
          ));
        };

        const { data, error } = await supabase.storage
          .from('bug-report-attachments')
          .upload(`public/${fileName}`, file, {
            upsert: false,
            contentType: file.type
          });

        if (error) {
          logger.error('[BugReportModal] Supabase upload error:', { fileName, error });
          throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        }
        logger.log('[BugReportModal] Upload successful:', { fileName, storagePath: data?.path });

        const { data: { publicUrl } } = supabase.storage
          .from('bug-report-attachments')
          .getPublicUrl(`public/${fileName}`);

        logger.log('[BugReportModal] Generated public URL:', { publicUrl, fileName });

        // Mark as successful and move to uploaded files
        setUploadingFiles(prev => prev.filter(f => f.fileName !== uploadingFile.fileName));
        setUploadedFiles(prev => [...prev, { url: publicUrl, fileName }]);

        return { url: publicUrl, fileName };
      });

      const results = await Promise.allSettled(uploadPromises);

      const successfulUploads: UploadedFileData[] = [];
      let firstError: Error | null = null;

      results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
              successfulUploads.push(result.value);
          } else if (result.status === 'rejected' && !firstError) {
              firstError = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
              logger.error('[BugReportModal] Upload failed for one file:', { reason: result.reason });
              
              // Mark the failed upload
              setUploadingFiles(prev => prev.map(f => 
                f.fileName === newUploadingFiles[index].fileName 
                  ? { ...f, status: 'error', error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
                  : f
              ));
          }
      });

      if (successfulUploads.length > 0) {
          logger.log('[BugReportModal] Files processed:', {
              successCount: successfulUploads.length,
              newTotal: uploadedFiles.length + successfulUploads.length,
              successfulFilesData: successfulUploads,
          });
      }

      if (firstError) {
          throw firstError;
      }

    } catch (err: any) {
      logger.error('[BugReportModal] Upload process error:', err);
      setUploadError(err.message || 'An error occurred during upload.');
    }
  };

  const handleFileDelete = async (fileNameToDelete: string) => {
    if (isDeleting) return;

    setUploadError(null);
    setIsDeleting(fileNameToDelete);
    logger.log('[BugReportModal] Attempting to delete file:', { bucket: 'bug-report-attachments', fileNameToDelete });

    try {
      const filePath = `public/${fileNameToDelete}`;
      const { error } = await supabase.storage
        .from('bug-report-attachments')
        .remove([filePath]);

      if (error) {
        logger.error('[BugReportModal] Supabase deletion error:', { fileNameToDelete, error });
        throw new Error(`Failed to delete ${fileNameToDelete}: ${error.message}`);
      }

      logger.log('[BugReportModal] File deleted from storage:', { fileNameToDelete });
      setUploadedFiles(currentFiles =>
        currentFiles.filter(file => file.fileName !== fileNameToDelete)
      );
      logger.log('[BugReportModal] State updated after deletion.');

    } catch (err: any) {
      logger.error('[BugReportModal] Deletion process error:', err);
      setUploadError(err.message || 'Failed to delete image.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!description || status === 'submitting' || isUploading || !!isDeleting) return;

    setStatus('submitting');
    setErrorMessage(null);
    const submissionData = { 
      description, 
      stepsToReproduce: stepsToReproduce || null,
      pageUrl: window.location.href,
      image_urls: uploadedFiles.map(file => file.url)
    };
    logger.log('[BugReportModal] Submitting bug report:', submissionData);

    try {
      const { data, error } = await supabase.functions.invoke('submit-bug-report', {
        body: submissionData,
      });

      if (error) {
        logger.error('[BugReportModal] Supabase function invocation error:', error);
        throw new Error(error.message || 'Failed to submit bug report via function.');
      }
      
      if (data && data.error) {
        logger.error('[BugReportModal] Function returned error:', data.error);
        throw new Error(data.error || 'Submission failed.');
      }
      
      if (!data) {
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
  };

  const currentFileCount = uploadedFiles.length + uploadingFiles.length;
  const canUploadMore = currentFileCount < IMAGE_LIMIT;
  const isUploading = uploadingFiles.length > 0;
  const inputId = `bug-report-file-upload`;
  const isUploadAreaDisabled = !canUploadMore || isUploading || !!isDeleting || status === 'submitting';

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
              onClick={onClose}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[var(--color-bg-surface)] rounded-sm p-4 sm:p-6 max-w-lg w-full relative z-[101] max-h-[90vh] overflow-y-auto shadow-xl border border-[var(--color-border-modal,theme(colors.gray.500/0.3))] color-text-primary backdrop-blur-sm flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={onClose}
                  className="absolute top-3 sm:top-4 right-3 sm:right-4 color-shade-2 hover:color-text-primary disabled:opacity-50"
                  disabled={status === 'submitting' || isUploading || !!isDeleting}
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-base sm:text-lg font-display color-text-primary mb-4 sm:mb-5">
                  Report an Issue
                </h3>

                {status === 'success' ? (
                  <div className="text-center p-4 bg-[var(--color-success-bg,theme(colors.green.600/0.2))] border border-[var(--color-success-border,theme(colors.green.500/0.5))] rounded-md">
                    <CheckCircle className="w-8 h-8 text-[var(--color-success-icon,theme(colors.green.400))] mx-auto mb-2" />
                    <p className="text-[var(--color-success-text,theme(colors.green.300))] font-medium font-mono">Thank you!</p>
                    <p className="text-sm text-[var(--color-text-secondary,theme(colors.gray.300))] mt-1 font-mono">Your report has been submitted.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col flex-grow space-y-4 font-mono">
                    <div>
                      <label htmlFor="description" className="block text-sm sm:text-base font-medium color-shade-2 mb-1">Description <span className="color-error-indicator">*</span></label>
                      <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the problem you encountered..."
                        required
                        rows={4}
                        className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-input-border,theme(colors.gray.600))] rounded-sm p-2 text-sm color-text-primary focus:ring-1 focus:ring-[var(--color-focus-ring,theme(colors.accent-primary))] focus:border-[var(--color-focus-ring,theme(colors.accent-primary))] placeholder:text-xs sm:placeholder:text-sm placeholder-shade-1 disabled:opacity-70"
                        disabled={status === 'submitting' || isUploading || !!isDeleting}
                      />
                    </div>
                    <div>
                       <label htmlFor="stepsToReproduce" className="block text-sm sm:text-base font-medium color-shade-2 mb-1">Steps to Reproduce (Optional)</label>
                       <textarea
                         id="stepsToReproduce"
                         value={stepsToReproduce}
                         onChange={(e) => setStepsToReproduce(e.target.value)}
                         placeholder="How can we make this happen?&#10;1. Go to...&#10;2. Click...&#10;3. See..."
                         rows={4}
                         className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-input-border,theme(colors.gray.600))] rounded-sm p-2 text-sm color-text-primary focus:ring-1 focus:ring-[var(--color-focus-ring,theme(colors.accent-primary))] focus:border-[var(--color-focus-ring,theme(colors.accent-primary))] placeholder:text-xs sm:placeholder:text-sm placeholder-shade-1 disabled:opacity-70"
                         disabled={status === 'submitting' || isUploading || !!isDeleting}
                       />
                    </div>

                    <div className="space-y-3">
                       <div className="flex justify-between items-baseline">
                           <label htmlFor={inputId} className="block text-sm sm:text-base font-medium color-shade-2 mb-1">Attach Screenshots (Optional)</label>
                           <span className="text-sm color-shade-2">
                               {currentFileCount} / {IMAGE_LIMIT} added
                           </span>
                       </div>

                       <label
                         htmlFor={inputId}
                         className={`relative block w-full border border-dashed border-[var(--color-input-border,theme(colors.gray.600))] rounded-sm p-3 text-center cursor-pointer transition-colors ${
                           isUploadAreaDisabled
                             ? 'bg-[var(--color-input-bg-disabled,theme(colors.gray.700/0.3))] opacity-60 cursor-not-allowed'
                             : 'bg-[var(--color-bg-surface)] hover:border-[var(--color-focus-ring,theme(colors.accent-primary))] hover:bg-[var(--color-input-bg-hover,theme(colors.gray.700/0.8))]'
                         }`}
                       >
                         <input
                           id={inputId}
                           type="file"
                           accept="image/*"
                           multiple
                           disabled={isUploadAreaDisabled}
                           onChange={(e) => {
                             const files = Array.from(e.target.files || []);
                             if (files.length > 0) {
                               handleFileUpload(files);
                             }
                             e.target.value = '';
                           }}
                           className="sr-only"
                         />
                         <div className="flex flex-col items-center justify-center color-shade-2">
                            <Upload className="w-5 h-5 mb-1" />
                            <span className="text-sm sm:text-base font-medium">
                               {isUploading ? `Uploading...` : (isDeleting ? 'Deleting...' : (canUploadMore ? 'Click or drag to upload' : `Limit reached (${IMAGE_LIMIT})`))}
                            </span>
                            {!isUploadAreaDisabled && <p className="text-xs sm:text-sm mt-0.5">Max {MAX_FILE_SIZE_MB}MB per image</p>}
                         </div>
                       </label>

                       {uploadError && (
                         <div className="flex items-center p-2 text-sm sm:text-base bg-[var(--color-error-bg,theme(colors.red.600/0.2))] border border-[var(--color-error-border,theme(colors.red.500/0.5))] rounded-md text-[var(--color-error-text,theme(colors.red.300))]">
                           <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                           <span className="font-mono">{uploadError}</span>
                         </div>
                       )}

                       {(uploadedFiles.length > 0 || uploadingFiles.length > 0) && (
                         <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-2">
                           {/* Show uploading placeholders first */}
                           {uploadingFiles.map((file, index) => (
                             <div key={file.fileName} className="relative group aspect-square bg-gray-700/50 rounded border border-[var(--color-border-modal,theme(colors.gray.500/0.3))] overflow-hidden">
                               <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800/50">
                                 {file.status === 'error' ? (
                                   <div className="text-center p-2">
                                     <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                                     <p className="text-xs text-red-300 font-mono text-center leading-tight">
                                       {file.error || 'Upload failed'}
                                     </p>
                                   </div>
                                 ) : (
                                   <div className="text-center p-2">
                                     <Loader2 className="w-6 h-6 text-blue-400 mx-auto mb-1 animate-spin" />
                                     <p className="text-xs text-blue-300 font-mono text-center leading-tight">
                                       Uploading...
                                     </p>
                                     <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                                       <div 
                                         className="bg-blue-400 h-1 rounded-full transition-all duration-300"
                                         style={{ width: `${file.progress}%` }}
                                       />
                                     </div>
                                   </div>
                                 )}
                               </div>
                             </div>
                           ))}
                           
                           {/* Show uploaded images */}
                           {uploadedFiles.map((file, index) => (
                             <div key={file.fileName} className="relative group aspect-square bg-gray-700/50 rounded border border-[var(--color-border-modal,theme(colors.gray.500/0.3))] overflow-hidden">
                               <img
                                 src={file.url}
                                 alt={`Attachment ${index + 1}: ${file.fileName}`}
                                 className="w-full h-full object-cover"
                                 onError={(e) => (e.currentTarget.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')}
                               />
                               <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-200 ${isDeleting === file.fileName ? 'opacity-100 cursor-wait' : 'opacity-0 group-hover:opacity-100'}`}>
                                 {isDeleting === file.fileName ? (
                                   <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                 ) : (
                                   <button
                                     type="button"
                                     onClick={() => handleFileDelete(file.fileName)}
                                     disabled={!!isDeleting || status === 'submitting'}
                                     className="text-white hover:color-error-indicator disabled:color-shade-2 disabled:cursor-not-allowed p-1 rounded-full bg-black/30 hover:bg-black/50 focus:outline-none focus:ring-1 focus:ring-white"
                                     aria-label={`Remove image ${index + 1}: ${file.fileName}`}
                                   >
                                     <X className="w-4 h-4" />
                                   </button>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>

                    {status === 'error' && !uploadError && (
                      <div className="flex items-center p-2 text-sm sm:text-base bg-[var(--color-error-bg,theme(colors.red.600/0.2))] border border-[var(--color-error-border,theme(colors.red.500/0.5))] rounded-md text-[var(--color-error-text,theme(colors.red.300))]">
                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="font-mono">{errorMessage || 'Submission failed. Please try again.'}</span>
                      </div>
                    )}

                    <div className="mt-auto pt-4 flex justify-end space-x-3">
                       <button
                          type="button"
                          onClick={onClose}
                          className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium rounded-sm color-shade-1 bg-[var(--color-button-secondary-bg,theme(colors.gray.600/0.5))] hover:bg-[var(--color-button-secondary-bg-hover,theme(colors.gray.600/0.8))] focus:outline-none focus:ring-2 focus:ring-[var(--color-button-secondary-focus-ring,theme(colors.gray.500))] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-offset,theme(colors.gray.800))] disabled:opacity-50 transition-colors font-mono"
                          disabled={status === 'submitting' || isUploading || !!isDeleting}
                       >
                         Cancel
                       </button>
                       <button
                          type="submit"
                          className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium rounded-sm text-stone-800 bg-accent-primary hover:bg-accent-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-[var(--color-focus-offset,theme(colors.gray.800))] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center font-mono"
                          disabled={!description || status === 'submitting' || isUploading || !!isDeleting}
                       >
                         {status === 'submitting' ? (
                           <>
                             <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-stone-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
