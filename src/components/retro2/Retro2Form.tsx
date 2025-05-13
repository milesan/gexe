import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RetroQuestionField } from './RetroQuestionField';
import { Send, LogOut } from 'lucide-react';
import { AutosaveNotification } from '../AutosaveNotification';
import { useAutosave } from '../../hooks/useAutosave';
import type { ApplicationQuestion } from '../../types/application';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { SignUpHeader } from './SignUpHeader';

interface Props {
  questions: ApplicationQuestion[];
  onSubmit: (data: any) => void;
  initialData?: Record<string, any>;
}

export function Retro2Form({ questions, onSubmit, initialData }: Props) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { saveData, loadSavedData, showSaveNotification, setShowSaveNotification } = useAutosave();
  const renderedSections = useRef(new Set<string>()); // Keep track of rendered section intros

  // Clear the set on every render to ensure clean state, especially with HMR
  renderedSections.current.clear();

  useEffect(() => {
    const initializeForm = async () => {
      const savedData = await loadSavedData();
      if (savedData) {
        setFormData(prevData => ({ ...savedData, ...prevData }));
      }
    };
    initializeForm();
  }, [loadSavedData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormComplete()) {
      console.warn("Submit attempted but form is incomplete. Scrolling to first error.");
      const visibleRequiredQuestions = questions.filter(q => q.is_visible !== false && q.required);
      
      const firstIncompleteQuestion = visibleRequiredQuestions.find(question => {
        const value = formData[question.order_number];
        const isMissing = Array.isArray(value) ? value.length === 0 : (value === undefined || value === '' || value === null);
        return isMissing;
      });

      if (firstIncompleteQuestion) {
        const elementId = `q-${firstIncompleteQuestion.order_number}`;
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Optional: try to focus the first input in the scrolled element
          const focusable = element.querySelector('input, textarea, select, button') as HTMLElement | null;
          if (focusable) {
            focusable.focus({ preventScroll: true }); // preventScroll because we just did that
          }
        } else {
          console.warn(`Element with id ${elementId} not found for scrolling.`);
        }
      }
      return; 
    }

    // If form is complete:
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('saved_applications')
          .delete()
          .eq('user_id', user.id);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (questionId: number, value: any) => {
    console.log('📝 Form field changed:', { questionId, value });
    setFormData(prevFormData => {
      const updatedFormData = {
        ...prevFormData,
        [questionId]: value
      };
      console.log('💾 Queuing auto-save after field change');
      saveData(updatedFormData);
      return updatedFormData;
    });
  };

  const isFormComplete = () => {
    const visibleQuestions = questions.filter(q => q.is_visible !== false);
    return visibleQuestions.every(question => {
      if (!question.required) return true;
      const value = formData[question.order_number];
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== '' && value !== null;
    });
  };

  return (
    <div className="bg-black text-retro-accent font-mono flex flex-col min-h-screen">
      <SignUpHeader />

      <div className="flex-grow pb-32">
        <div className="max-w-xl mx-auto px-4 pt-8 space-y-12">
          {questions
            .filter(question => question.is_visible !== false)
            .map((question, index) => {
            const sectionIntro = question.section_intro_markdown;
            const sectionName = question.section;
            const showIntro = sectionIntro && !renderedSections.current.has(sectionName);

            if (showIntro) {
              renderedSections.current.add(sectionName); // Mark section as rendered
            }

            return (
              <div key={question.id} id={`q-${question.order_number}`}>
                {showIntro && (
                  <div className="prose prose-invert prose-retro-accent prose-a:underline mb-8 p-4 border-l-4 border-retro-accent/50 bg-black/20">
                    {/* Use ReactMarkdown for the intro */}
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({node, ...props}) => <a {...props} style={{textDecoration: 'underline'}} />
                      }}
                    >
                      {sectionIntro}
                    </ReactMarkdown>
                  </div>
                )}
                <RetroQuestionField
                  question={question}
                  value={formData[question.order_number]}
                  onChange={value => handleChange(question.order_number, value)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none bg-gradient-to-t from-black via-black to-transparent pt-10">
        <div className="max-w-xl mx-auto px-4 flex flex-col items-center">
          <div className="w-full flex justify-center mb-2 pointer-events-auto">
            <AutosaveNotification
              show={showSaveNotification}
              onClose={() => setShowSaveNotification(false)}
            />
          </div>

          <div className="flex justify-center items-center w-full pointer-events-auto pb-4">
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className={`group flex items-center justify-center gap-2 px-6 py-3 text-lg transition-colors min-w-44 ${
                isSubmitting || !isFormComplete()
                  ? 'bg-retro-accent/10 text-retro-accent'
                  : 'bg-retro-accent text-black hover:bg-accent-secondary'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
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
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-retro-accent/50 border-t-transparent mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}