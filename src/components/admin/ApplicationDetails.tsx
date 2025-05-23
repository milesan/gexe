import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAnswer as getSharedAnswer } from '../../lib/old_question_mapping';
import type { QuestionForAnswerRetrieval } from '../../lib/old_question_mapping';
import type { ApplicationQuestion } from '../../types/application';
import { ImageModal } from '../shared/ImageModal';
import { SmartImage } from '../shared/SmartImage';

interface ApplicationDetailsProps {
  application: any;
  onClose: () => void;
  questions: ApplicationQuestion[];
}

export function ApplicationDetails({ application, onClose, questions }: ApplicationDetailsProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const sections = Array.from(new Set(questions.map(q => q.section))).sort((a, b) => {
    const order = ['intro', 'main', 'core', 'supplemental', 'final'];
    const aIndex = order.indexOf(a?.toLowerCase() || '');
    const bIndex = order.indexOf(b?.toLowerCase() || '');
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return (a || '').localeCompare(b || '');
  });

  const firstNameQuestion = questions.find(q => q.text === "First Name") as QuestionForAnswerRetrieval | undefined;
  const lastNameQuestion = questions.find(q => q.text === "Last Name") as QuestionForAnswerRetrieval | undefined;

  const firstName = firstNameQuestion ? getSharedAnswer(application.data, firstNameQuestion) : '';
  const lastName = lastNameQuestion ? getSharedAnswer(application.data, lastNameQuestion) : '';

  const renderPhotoGrid = (photoAnswer: any) => {
    if (!photoAnswer) return null;

    let photoUrls: string[] = [];
    try {
      if (Array.isArray(photoAnswer)) {
        photoUrls = photoAnswer.map(p => p.url).filter(Boolean);
      } else if (typeof photoAnswer === 'object' && photoAnswer.url) {
        photoUrls = [photoAnswer.url].filter(Boolean);
      }
    } catch (e) {
      console.error("Error processing photo URLs:", e, "Photo answer was:", photoAnswer);
      return null;
    }

    if (photoUrls.length === 0) return <p className="text-sm text-[var(--color-text-tertiary)]">No photos provided.</p>;

    const gridConfig = {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-2',
      4: 'grid-cols-2'
    };

    return (
      <div className={`grid ${gridConfig[Math.min(photoUrls.length, 4) as keyof typeof gridConfig]} gap-2 aspect-square`}>
        {photoUrls.slice(0, 4).map((url, index) => (
          <SmartImage
            key={index}
            src={url}
            alt={`Applicant photo ${index + 1}`}
            className={`w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
              photoUrls.length === 3 && index === 2 ? 'col-span-2' : ''
            }`}
            onClick={() => setSelectedImage(url)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-bg-main)] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
            <div>
              <h2 className="text-xl font-medium text-[var(--color-text-primary)]">
                {firstName} {lastName}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{application.user_email}</p>
            </div>
            <button 
              onClick={onClose} 
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {sections.map((section) => (
                <div key={section} className="mb-8">
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4 capitalize">
                    {section || 'Uncategorized'}
                  </h3>
                  <div className="space-y-6">
                    {questions
                      .filter(q => q.section === section)
                      .map((question) => {
                        const currentQuestion = question as QuestionForAnswerRetrieval;
                        const answer = getSharedAnswer(application.data, currentQuestion);
                        
                        return (
                          <div key={question.id} className="bg-[var(--color-bg-subtle)] p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                              {question.text}
                            </h4>
                            <div className="text-[var(--color-text-secondary)] whitespace-pre-wrap">
                              {question.type === 'file' ? (
                                renderPhotoGrid(answer)
                              ) : (
                                typeof answer === 'object' && answer !== null && answer.selection ? 
                                  answer.selection :
                                (answer === undefined || answer === null || answer === '') ? 
                                  <span className="text-sm text-[var(--color-text-tertiary)]">No response</span> :
                                  String(answer)
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
}