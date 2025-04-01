import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Upload, X } from 'lucide-react';
import type { ApplicationQuestion } from '../../types/application';
import { supabase } from '../../lib/supabase';

interface Props {
  question: ApplicationQuestion;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  themeColor?: string;
  questionIndex: number;
}

export function RetroQuestionField({ question, value, onChange, onBlur, themeColor = 'garden-gold', questionIndex }: Props) {
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isConsentQuestion = questionIndex === 0 && question.section === 'intro';
  const isMBTIQuestion = question.text.toLowerCase().includes('mbti');
  const isImageUpload = question.type === 'file';

  const handleNoConsent = () => {
    window.location.href = 'https://www.youtube.com/watch?v=xvFZjo5PgG0';
  };

  const handleFileUpload = async (files: File[]) => {
    setUploadError(null);
    setUploadProgress(0);
    console.log('🖼️ Starting file upload:', { 
      numberOfFiles: files.length,
      fileNames: files.map(f => f.name),
      questionId: question.order_number 
    });
    
    try {
      const uploadedUrls = await Promise.all(
        files.map(async (file) => {
          // Validate file type and size
          if (!file.type.startsWith('image/')) {
            throw new Error('Please upload only image files');
          }
          if (file.size > 5 * 1024 * 1024) { // 5MB limit
            throw new Error('File size must be less than 5MB');
          }

          const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
          console.log('📤 Uploading to storage:', { fileName });
          
          const { data, error } = await supabase.storage
            .from('application-photos')
            .upload(`photos/${fileName}`, file, {
              upsert: false,
              contentType: file.type
            });

          if (error) throw error;
          console.log('✅ Upload successful:', { fileName });

          const { data: { publicUrl } } = supabase.storage
            .from('application-photos')
            .getPublicUrl(`photos/${fileName}`);

          console.log('🔗 Generated public URL:', { publicUrl });

          setUploadProgress((prev) => prev + (100 / files.length));
          return { url: publicUrl };
        })
      );

      console.log('📸 All files uploaded, calling onChange with URLs:', uploadedUrls);
      onChange(uploadedUrls);
      setUploadProgress(100);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload image');
      setUploadProgress(0);
    }
  };

  if (isImageUpload) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-display text-[#FFBF00]">
          {question.text}
          <span className="text-red-500 ml-1">*</span>
        </h3>

        <div className="relative">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              handleFileUpload(files);
            }}
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
          
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-[#FFBF00]">
                <Upload className="w-6 h-6 animate-bounce" />
                <span className="ml-2">{Math.round(uploadProgress)}%</span>
              </div>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="flex items-center text-red-500">
            <X className="w-4 h-4 mr-2" />
            {uploadError}
          </div>
        )}

        {value && value.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {value.map((file: { url: string }, index: number) => (
              <div key={index} className="relative">
                <img 
                  src={file.url} 
                  alt={`Uploaded photo ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
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
              <div className="flex justify-center gap-8">
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