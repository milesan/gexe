import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RetroQuestionField } from './RetroQuestionField';
import { Send, ChevronRight, LogOut, Terminal, ChevronLeft } from 'lucide-react';
import { AutosaveNotification } from '../AutosaveNotification';
import { useAutosave } from '../../hooks/useAutosave';
import type { ApplicationQuestion } from '../../types/application';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface Props {
  questions: ApplicationQuestion[];
  onSubmit: (data: any) => void;
  isFullyVisible?: boolean;
}

export function Retro2Form({ questions, onSubmit, isFullyVisible }: Props) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const firstIncompleteRef = useRef<HTMLDivElement>(null);
  const { saveData, loadSavedData, showSaveNotification, setShowSaveNotification } = useAutosave();

  // Memoize sections to ensure stable reference
  const { sections, sectionNames } = useMemo(() => {
    if (!questions?.length) return { sections: {}, sectionNames: [] };
    
    const sections = questions.reduce((acc, question) => {
      const section = question.section || 'Other';
      if (!acc[section]) {
        acc[section] = [];
      }
      acc[section].push(question);
      return acc;
    }, {} as Record<string, ApplicationQuestion[]>);

    return {
      sections,
      sectionNames: Object.keys(sections)
    };
  }, [questions]);

  useEffect(() => {
    const initializeForm = async () => {
      if (!sectionNames.length) return;
      
      const savedData = await loadSavedData();
      if (savedData) {
        setFormData(savedData);
        // Find the first incomplete section
        let lastCompleteSection = -1;
        for (let i = 0; i < sectionNames.length; i++) {
          const sectionQuestions = questions.filter(q => q.section === sectionNames[i].toLowerCase());
          const isSectionComplete = sectionQuestions.every(question => {
            if (!question.required) return true;
            const value = savedData[question.order_number];
            return value !== undefined && value !== '' && value !== null;
          });
          if (!isSectionComplete) break;
          lastCompleteSection = i;
        }
        
        // If all sections are complete, put user on the last section
        // Otherwise, put them on the first incomplete section
        if (lastCompleteSection === sectionNames.length - 1) {
          setCurrentSection(sectionNames.length - 1);
        } else {
          setCurrentSection(lastCompleteSection + 1);
        }
      }
    };
    initializeForm();
  }, [loadSavedData, questions, sectionNames]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Clear saved data after successful submission
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

  // Function to navigate to the next section if the current one is complete
  const goToNextSection = () => {
    if (isCurrentSectionComplete() && currentSection < sectionNames.length - 1) {
      console.log('⏭️ Navigating to next section');
      setCurrentSection(prev => prev + 1);
    } else {
      console.log('🚫 Cannot navigate to next section', { 
        isComplete: isCurrentSectionComplete(), 
        currentSection, 
        totalSections: sectionNames.length 
      });
    }
  };

  const handleChange = (questionId: number, value: any) => {
    console.log('📝 Form field changed:', { 
      questionId, 
      isImageUpload: Array.isArray(value) && value.length > 0 && value[0]?.url,
      value: Array.isArray(value) && value.length > 0 && value[0]?.url ? 'Image URLs' : value
    });
    // const newFormData = {
    //   ...formData,
    //   [questionId]: value
    // };
    // setFormData(newFormData);

    // Use functional update to ensure we're working with the latest state
    setFormData(prevFormData => {
      const updatedFormData = {
        ...prevFormData,
        [questionId]: value
      };

      // Save the updated data. Passing it directly avoids potential closure issues
      // with the previous setTimeout approach.
      console.log('💾 Queuing auto-save after field change');
      saveData(updatedFormData); 

      return updatedFormData; // Return the new state for setFormData
    });

    // Save after state update - Moved inside the functional update
    // setTimeout(() => {
    //   console.log('💾 Auto-saving after field change');
    //   saveData(newFormData);  // Use newFormData instead of formData to ensure we have latest
    // }, 0);

    // If this is the consent question and user consents, auto-advance
    const consentQuestion = questions.find(q => q.section === 'intro');
    if (consentQuestion && questionId === consentQuestion.order_number && value === 'As you wish.') {
      console.log('User consented, attempting to move to next section immediately');
      // Call the centralized navigation function directly
      goToNextSection(); 
      // setTimeout(() => { // Remove the delay and direct setting
      //   setCurrentSection(1);
      // }, 500);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Add null check for currentSectionName
  const currentSectionName = sectionNames[currentSection] || sectionNames[0] || '';
  const currentQuestions = sections[currentSectionName] || [];

  const isCurrentSectionComplete = () => {
    return currentQuestions.every(question => {
      if (!question.required) return true;
      const value = formData[question.order_number];
      return value !== undefined && value !== '' && value !== null;
    });
  };

  const progress = ((currentSection + 1) / sectionNames.length) * 100;

  useEffect(() => {
    if (contentRef.current && isFullyVisible) {
      contentRef.current.scrollTop = 0;
      // Add a small delay to ensure the DOM has updated
      setTimeout(() => {
        firstIncompleteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [currentSection, isFullyVisible]);

  return (
    <div className="min-h-screen bg-black text-retro-accent font-mono">
      <div className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-retro-accent/20">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-lettra-bold">The Garden</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-retro-accent/10 hover:bg-retro-accent/20 transition-colors rounded"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="flex gap-6 py-2 overflow-x-auto scrollbar-none">
            {sectionNames.map((name, index) => (
              <button
                key={name}
                disabled={index > currentSection && !isCurrentSectionComplete()}
                onClick={() => index <= currentSection && setCurrentSection(index)}
                className={`whitespace-nowrap transition-all ${
                  index === currentSection
                    ? `text-retro-accent`
                    : index < currentSection
                    ? `text-retro-accent/60 hover:text-retro-accent/80`
                    : `text-retro-accent/30`
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="h-0.5 bg-retro-accent/10">
            <motion.div
              className="h-full bg-retro-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      <div 
        ref={contentRef}
        className="fixed top-[140px] bottom-[120px] left-0 right-0 overflow-y-auto"
      >
        <div className="max-w-xl mx-auto px-4 relative">
          <motion.div
            key={currentSectionName}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-12 pb-4"
          >
            {questions
              .filter(q => {
                const currentSectionName = sectionNames[currentSection];
                if (!currentSectionName) return false;
                return q.section === currentSectionName.toLowerCase();
              })
              .map((question, index) => (
                <div
                  key={question.id}
                  ref={index === 0 && !isCurrentSectionComplete() ? firstIncompleteRef : undefined}
                >
                  <RetroQuestionField
                    question={question}
                    questionIndex={index}
                    value={formData[question.order_number]}
                    onChange={value => handleChange(question.order_number, value)}
                  />
                </div>
              ))}
          </motion.div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="max-w-xl mx-auto px-4 flex flex-col items-center">
          <div className="w-full flex justify-center mb-2 pointer-events-auto">
            <AutosaveNotification 
              show={showSaveNotification} 
              onClose={() => setShowSaveNotification(false)} 
            />
          </div>

          <div className="flex justify-between items-center w-full pointer-events-auto pb-4">
            <div className="pointer-events-auto"> 
              {currentSection > 0 ? (
                <button
                  type="button"
                  onClick={() => setCurrentSection(prev => Math.max(0, prev - 1))}
                  className="group hover:bg-accent-secondary flex items-center gap-2 px-4 py-2 transition-all bg-retro-accent text-black disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
              ) : (
                <div className="w-[98px]"></div>
              )}
            </div>

            <div className="pointer-events-auto"> 
              {currentSection === sectionNames.length - 1 ? (
                <button
                  type="submit"
                  disabled={isSubmitting || !isCurrentSectionComplete()}
                  onClick={handleSubmit}
                  className={`group flex items-center justify-center gap-2 px-4 py-2 transition-colors min-w-44 ${
                    isSubmitting || !isCurrentSectionComplete() 
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
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit
                    </>
                  )}
                </button>
              ) : currentSection < sectionNames.length - 1 ? (
                 <button
                    type="button"
                    onClick={goToNextSection} 
                    disabled={!isCurrentSectionComplete()}
                    className={`group flex items-center gap-2 px-4 py-2 transition-all  ${
                      isCurrentSectionComplete() 
                        ? 'bg-retro-accent text-black hover:bg-accent-secondary' 
                        : 'bg-retro-accent/10 text-retro-accent'
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
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}