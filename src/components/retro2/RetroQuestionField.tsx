import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Upload, X } from 'lucide-react';
import type { ApplicationQuestion } from '../../types/application';
import { supabase } from '../../lib/supabase';

// Define the structure for uploaded file data
interface UploadedFileData {
  url: string;
  fileName: string;
}

interface Props {
  question: ApplicationQuestion;
  value: UploadedFileData[] | any; // Allow initial `any` but expect UploadedFileData[]
  onChange: (value: UploadedFileData[] | any) => void; // Update onChange type accordingly
  onBlur?: () => void;
  themeColor?: string;
  questionIndex: number;
}

const IMAGE_LIMIT = 3;

export function RetroQuestionField({ question, value, onChange, onBlur, themeColor = 'garden-gold', questionIndex }: Props) {
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Track which file is being deleted
  const isConsentQuestion = questionIndex === 0 && question.section === 'intro';
  const isMBTIQuestion = question.text.toLowerCase().includes('mbti');
  const isImageUpload = question.type === 'file';

  // Ensure value is always an array for file uploads
  const currentFiles: UploadedFileData[] = useMemo(() => 
    isImageUpload && Array.isArray(value) ? value : [], 
    [value, isImageUpload]
  );

  const handleNoConsent = () => {
    window.location.href = 'https://www.youtube.com/watch?v=xvFZjo5PgG0';
  };

  const handleFileUpload = async (files: File[]) => {
    setUploadError(null);
    setUploadProgress(0);
    
    const filesToUpload = files.slice(0, IMAGE_LIMIT - currentFiles.length);

    if (files.length > filesToUpload.length) {
      setUploadError(`You can only upload up to ${IMAGE_LIMIT} images in total.`);
      console.warn(`Upload limit reached. Allowed: ${filesToUpload.length}, Tried: ${files.length}`);
      // Only upload the allowed number if some are allowed
      if (filesToUpload.length === 0) return; 
    }
    
    if (filesToUpload.length === 0) {
        setUploadError(`You have already reached the limit of ${IMAGE_LIMIT} images.`);
        console.log('🖼️ Upload skipped: Limit already reached.');
        return;
    }

    console.log('🖼️ Starting file upload:', { 
      numberOfFiles: filesToUpload.length,
      attemptedFileNames: files.map(f => f.name),
      uploadingFileNames: filesToUpload.map(f => f.name),
      questionId: question.order_number,
      currentFileCount: currentFiles.length
    });
    
    try {
      const uploadedFilesData = await Promise.all(
        filesToUpload.map(async (file) => {
          // Validate file type and size
          if (!file.type.startsWith('image/')) {
            console.warn('Skipping non-image file:', file.name);
            throw new Error(`Skipped '${file.name}': Only image files are allowed.`);
          }
          if (file.size > 5 * 1024 * 1024) { // 5MB limit
            console.warn('Skipping oversized file:', file.name, file.size);
            throw new Error(`Skipped '${file.name}': File size must be less than 5MB.`);
          }

          const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '');
          const fileName = `${Date.now()}-${safeFileName}`;
          console.log('📤 Uploading to storage:', { fileName });
          
          const { data, error } = await supabase.storage
            .from('application-photos')
            .upload(`photos/${fileName}`, file, {
              upsert: false, // Don't replace existing files with the same name (though unlikely with timestamp)
              contentType: file.type
            });

          if (error) {
            console.error('Supabase upload error:', error);
            throw new Error(`Failed to upload ${file.name}: ${error.message}`);
          }
          console.log('✅ Upload successful:', { fileName });

          const { data: { publicUrl } } = supabase.storage
            .from('application-photos')
            .getPublicUrl(`photos/${fileName}`);

          console.log('🔗 Generated public URL:', { publicUrl, fileName });

          // Update progress based on the number of files *successfully* starting upload
          setUploadProgress((prev) => prev + (100 / filesToUpload.length)); 
          return { url: publicUrl, fileName }; // Return object with url and fileName
        })
      );

      // Filter out any potential nulls if errors were handled differently
      const successfulUploads = uploadedFilesData.filter(Boolean) as UploadedFileData[];
      
      const updatedFiles = [...currentFiles, ...successfulUploads];
      console.log('📸 All files processed, calling onChange with updated file list:', {
        previousCount: currentFiles.length,
        newCount: successfulUploads.length,
        totalCount: updatedFiles.length,
        updatedFilesData: updatedFiles, // Log the actual data being sent
      });
      onChange(updatedFiles);
      setUploadProgress(100); // Mark as complete
      // Optionally clear progress after a delay
      // setTimeout(() => setUploadProgress(0), 2000); 

    } catch (err: any) {
      console.error('Upload process error:', err);
      // Display the first error encountered
      setUploadError(err.message || 'An error occurred during upload.');
      setUploadProgress(0); // Reset progress on error
      // Note: Partial uploads might have occurred and been added to state before the error.
      // Consider if onChange should only be called if ALL uploads succeed.
      // Current logic calls onChange with successfully uploaded files from the batch before error.
    }
  };

  const handleFileDelete = async (fileNameToDelete: string) => {
    if (isDeleting) return; // Prevent concurrent deletions

    setUploadError(null); // Clear previous errors
    setIsDeleting(fileNameToDelete); // Set deleting state for specific file
    console.log('🗑️ Attempting to delete file:', { fileNameToDelete });

    try {
      const { error } = await supabase.storage
        .from('application-photos')
        .remove([`photos/${fileNameToDelete}`]);

      if (error) {
        console.error('Supabase deletion error:', error);
        throw new Error(`Failed to delete ${fileNameToDelete}: ${error.message}`);
      }

      console.log('✅ File deleted from storage:', { fileNameToDelete });
      const updatedFiles = currentFiles.filter(file => file.fileName !== fileNameToDelete);
      console.log('🔄 Updating state after deletion:', { updatedFiles });
      onChange(updatedFiles);

    } catch (err: any) {
      console.error('Deletion process error:', err);
      setUploadError(err.message || 'Failed to delete image.');
    } finally {
      setIsDeleting(null); // Reset deleting state
    }
  };


  if (isImageUpload) {
    const currentFileCount = currentFiles.length;
    const canUploadMore = currentFileCount < IMAGE_LIMIT;
    const inputId = `file-upload-${question.order_number}`;
    const isDisabled = !canUploadMore || (uploadProgress > 0 && uploadProgress < 100) || !!isDeleting;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-baseline">
          <h3 className="text-xl font-display text-[#FFBF00]">
            {question.text}
            <span className="text-red-500 ml-1">*</span>
          </h3>
          <span className="text-sm text-[#FFBF00]/60">
            {currentFileCount} / {IMAGE_LIMIT} images uploaded
          </span>
        </div>

        {/* Use label to wrap and trigger the hidden input */}
        <label 
          htmlFor={inputId}
          className={`relative block w-full cursor-pointer font-mono ${isDisabled ? 'cursor-not-allowed' : ''}`}
          // Apply the clip-path style to the label which acts as the container
          style={{
            clipPath: `polygon(
              0 4px, 4px 4px, 4px 0,
              calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
              100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
              calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
              0 calc(100% - 4px)
            )`
          }}
        >
          {/* Visually hidden but accessible file input */}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            disabled={isDisabled} // Disable while uploading/deleting or if limit reached
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                handleFileUpload(files);
              }
              // Reset input value to allow re-uploading the same file if needed
              e.target.value = ''; 
            }}
            className="sr-only" // Hide the default input visually
          />

          {/* Styled replacement for the input */}
          <div
            className={`w-full bg-black p-3 text-[#FFBF00] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#FFBF00] placeholder-[#FFBF00]/30 border-4 border-[#FFBF00]/30 flex items-center justify-center transition-colors ${ 
              isDisabled ? 'opacity-50 bg-gray-800' : 'hover:bg-[#FFBF00]/10'
            }`}
          >
            <Upload className="w-5 h-5 mr-2" />
            <span className="font-sans"> {/* Use font-sans for regular text */}
              {isDisabled 
                ? (uploadProgress > 0 && uploadProgress < 100 ? 'Uploading...' : (isDeleting ? 'Deleting...' : `Limit Reached (${IMAGE_LIMIT})`))
                : 'Browse Images'
              }
            </span>
          </div>

          {/* Progress Indicator Overlay */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-[#FFBF00]">
              <div className="text-center">
                <Upload className="w-6 h-6 animate-bounce mx-auto mb-1" />
                <span>{Math.round(uploadProgress)}%</span>
              </div>
            </div>
          )}
        </label>

        {uploadError && (
          <div className="flex items-center text-red-500">
            <X className="w-4 h-4 mr-2" />
            {uploadError}
          </div>
        )}

        {currentFiles.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {currentFiles.map((file: UploadedFileData, index: number) => (
              <div key={file.fileName || index} className="relative group">
                <img 
                  src={file.url} 
                  alt={`Uploaded photo ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border-2 border-[#FFBF00]/20"
                />
                 {/* Delete Button Overlay */}
                 <div className={`absolute inset-0 bg-black/70 flex items-center justify-center transition-opacity duration-300 ${isDeleting === file.fileName ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                   {isDeleting === file.fileName ? (
                     <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#FFBF00] border-t-transparent"></div>
                   ) : (
                     <button
                       onClick={() => handleFileDelete(file.fileName)}
                       disabled={!!isDeleting} // Disable while another delete is in progress
                       className="text-[#FFBF00] hover:text-red-500 disabled:text-gray-500 disabled:cursor-not-allowed"
                       aria-label={`Delete image ${index + 1}`}
                     >
                       <X className="w-6 h-6" />
                     </button>
                   )}
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isMBTIQuestion) {
    return (
      <div className="space-y-4">
        <h3 className="text-2xl font-display text-[#FFBF00]">
          {question.text}
          <span className="text-red-500 ml-1">*</span>
        </h3>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full bg-black p-3 text-[#FFBF00] focus:outline-none focus:ring-2 focus:ring-[#FFBF00] placeholder-[#FFBF00]/30 border-4 border-[#FFBF00]/30"
          style={{
            clipPath: `polygon(
              0 4px, 4px 4px, 4px 0,
              calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
              100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
              calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
              0 calc(100% - 4px)
            )`
          }}
        />
      </div>
    );
  }

  if (question.type === 'radio' && question.options) {
    const options = Array.isArray(question.options) 
      ? question.options 
      : JSON.parse(question.options);

    const handleChange = (option: string) => {
      if (isConsentQuestion && option === 'Inconceivable!') {
        handleNoConsent();
        return;
      }
      onChange(option);
      if (onBlur) onBlur();
    };

    return (
      <div className="space-y-4">
        {isConsentQuestion ? (
          <motion.div 
            className="space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            <div className="relative">
              <div className="absolute -left-8 top-0 bottom-0 w-2 bg-gradient-to-b from-[#FFBF00]/60 via-[#FFBF00]/40 to-[#FFBF00]/20" />
              <motion.div 
                className="space-y-6 pl-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
              >
                <div className="space-y-6 font-display text-2xl leading-relaxed max-w-2xl">
                  <p className="text-[#FFBF00]/60">This is a curated place, unlike any other.</p>
                  <p className="text-[#FFBF00]/70">We seek those with the attention span & curiosity 
                  to complete this application.</p>
                  <p className="text-[#FFBF00]/80">We're not impressed by your followers, fortune, 
                  or fame [though none of those exclude you].</p>
                  <p className="text-[#FFBF00] text-3xl">We seek the realest.</p>
                </div>
              </motion.div>
            </div>

            <motion.div 
              className="pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
            >
              <h3 className="text-2xl font-display mb-2 text-[#FFBF00]/90">
                {question.text}
                <span className="text-red-500 ml-1">*</span>
              </h3>
              <p className="text-sm text-[#FFBF00]/60 -mt-1 mb-6">
                We value data privacy.
              </p>
              {/* Make container flex-col by default, sm:flex-row, and adjust gap */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8">
                <button 
                  onClick={() => handleChange('As you wish.')}
                  className="bg-[#FFBF00] text-black px-8 py-4 text-xl transition-colors hover:bg-[#FFBF00]/90"
                  style={{
                    clipPath: `polygon(
                      0 4px, 4px 4px, 4px 0,
                      calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                      100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                      calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                      0 calc(100% - 4px)
                    )`
                  }}
                >
                  As you wish.
                </button>
                <button 
                  onClick={() => handleChange('Inconceivable!')}
                  className="bg-[#FFBF00] text-black px-8 py-4 text-xl opacity-80 transition-colors hover:bg-[#FFBF00]/90"
                  style={{
                    clipPath: `polygon(
                      0 4px, 4px 4px, 4px 0,
                      calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                      100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                      calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                      0 calc(100% - 4px)
                    )`
                  }}
                >
                  Inconceivable!
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <>
            <h3 className="text-2xl font-display text-[#FFBF00]">
              {question.text}
              <span className="text-red-500 ml-1">*</span>
            </h3>
            <div className="space-y-2">
              {options.map((option: string) => {
                const isSelected = value === option;
                return (
                  <label 
                    key={option} 
                    className={`flex items-center p-3 cursor-pointer transition-all ${
                      isSelected 
                        ? `bg-[#FFBF00]/20` 
                        : `hover:bg-[#FFBF00]/10`
                    }`}
                    style={{
                      clipPath: `polygon(
                        0 4px, 4px 4px, 4px 0,
                        calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                        100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                        calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                        0 calc(100% - 4px)
                      )`
                    }}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 mr-4 flex items-center justify-center transition-colors ${
                      isSelected 
                        ? `border-4 border-[#FFBF00] bg-[#FFBF00]` 
                        : `border-4 border-[#FFBF00]`
                    }`}
                    style={{
                      clipPath: `polygon(
                        0 4px, 4px 4px, 4px 0,
                        calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                        100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                        calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                        0 calc(100% - 4px)
                      )`
                    }}
                    >
                      {isSelected && <Check className="w-4 h-4 text-black" />}
                    </div>
                    <input
                      type="radio"
                      name={`question-${questionIndex}`}
                      value={option}
                      checked={isSelected}
                      onChange={() => handleChange(option)}
                      className="sr-only"
                    />
                    <span className="text-base text-[#FFBF00]">{option}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  if (question.type === 'textarea') {
    return (
      <div className="space-y-4">
        <h3 className="text-2xl font-display text-[#FFBF00]">
          {question.text}
          <span className="text-red-500 ml-1">*</span>
        </h3>
        <div className="relative">
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="w-full bg-black p-3 text-[#FFBF00] focus:outline-none focus:ring-2 focus:ring-[#FFBF00] placeholder-[#FFBF00]/30 border-4 border-[#FFBF00]/30"
            rows={4}
            style={{
              clipPath: `polygon(
                0 4px, 4px 4px, 4px 0,
                calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                0 calc(100% - 4px)
              )`
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-display text-[#FFBF00]">
        {question.text}
        <span className="text-red-500 ml-1">*</span>
      </h3>
      <div className="relative">
        <input
          type={question.type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full bg-black p-3 text-[#FFBF00] focus:outline-none focus:ring-2 focus:ring-[#FFBF00] placeholder-[#FFBF00]/30 border-4 border-[#FFBF00]/30"
          style={{
            clipPath: `polygon(
              0 4px, 4px 4px, 4px 0,
              calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
              100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
              calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
              0 calc(100% - 4px)
            )`
          }}
        />
      </div>
    </div>
  );
}