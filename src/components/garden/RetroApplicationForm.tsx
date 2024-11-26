import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RetroQuestionField } from './RetroQuestionField';
import { Sprout, Send, ChevronRight, LogOut, Terminal } from 'lucide-react';
import type { ApplicationQuestion } from '../../types/application';
import { supabase } from '../../lib/supabase';

interface Props {
  questions: ApplicationQuestion[];
  onSubmit: (data: any) => void;
}

export function RetroApplicationForm({ questions, onSubmit }: Props) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [useMatrixTheme] = useState(() => Math.random() < 0.33);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (questionId: number, value: any) => {
    setFormData(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAutoAdvance = () => {
    setCurrentSection(prev => Math.min(sectionNames.length - 1, prev + 1));
  };

  const sections = questions.reduce((acc, question) => {
    const section = question.section || 'Other';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(question);
    return acc;
  }, {} as Record<string, ApplicationQuestion[]>);

  const sectionNames = Object.keys(sections);
  const currentSectionName = sectionNames[currentSection];
  const currentQuestions = sections[currentSectionName] || [];
  
  const progress = ((currentSection + 1) / sectionNames.length) * 100;
  const themeColor = useMatrixTheme ? 'garden-matrix' : 'garden-gold';

  return (
    <div className="min-h-screen bg-garden-dark text-garden-gold font-mono p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <motion.div 
          className="flex flex-col md:flex-row items-center justify-between mb-8 md:mb-16 space-y-4 md:space-y-0"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <Sprout className={`w-12 h-12 md:w-16 md:h-16 text-${themeColor}`} />
              <pre className={`absolute -top-2 -right-2 text-[8px] text-${themeColor}/60`}>
           
              </pre>
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-display mb-2">The Garden</h1>
              <div className="relative">
                <div className={`w-full bg-${themeColor}/20 h-1`}>
                  <motion.div 
                    className={`h-full bg-${themeColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className={`group flex items-center gap-2 px-4 py-2 text-${themeColor} hover:text-${themeColor} transition-colors pixel-corners relative`}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
            <pre className={`absolute -bottom-4 left-0 text-[8px] text-${themeColor}/40 group-hover:text-${themeColor}/60 transition-colors`}>
              └──┘
            </pre>
          </button>
        </motion.div>

        <div className="relative flex gap-4 md:gap-8 mb-8 md:mb-12 overflow-x-auto pb-4 scrollbar-thin">
          {sectionNames.map((name, index) => (
            <button
              key={name}
              onClick={() => setCurrentSection(index)}
              className={`text-xl md:text-2xl font-display whitespace-nowrap transition-all group ${
                index === currentSection
                  ? `text-${themeColor} scale-110`
                  : `text-${themeColor}/40 hover:text-${themeColor}/60`
              }`}
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
              {index === currentSection && (
                <pre className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-${themeColor}/60`}>
                  ▲
                </pre>
              )}
            </button>
          ))}
          <pre className={`absolute -bottom-2 left-0 right-0 text-[8px] text-${themeColor}/20`}>
            {'═'.repeat(100)}
          </pre>
        </div>

        <motion.div
          key={currentSectionName}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-12 md:space-y-16 pb-32"
        >
          {currentQuestions.map((question, index) => (
            <div 
              key={question.order_number}
              className={`space-y-4 md:space-y-6 relative ${
                index !== currentQuestions.length - 1 ? 'pb-12' : ''
              }`}
            >
              <RetroQuestionField
                question={question}
                value={formData[question.order_number]}
                onChange={(value) => handleChange(question.order_number, value)}
                onAutoAdvance={handleAutoAdvance}
                themeColor={themeColor}
              />
              {index !== currentQuestions.length - 1 && (
                <div className={`absolute bottom-0 left-0 right-0 h-px bg-${themeColor}/10`}>
                  <div className={`absolute left-1/2 -translate-x-1/2 -bottom-2 text-${themeColor}/20 text-xs`}>
                    ▼
                  </div>
                </div>
              )}
            </div>
          ))}
        </motion.div>

        <div className="fixed bottom-4 md:bottom-8 right-4 md:right-8 left-4 md:left-8 flex justify-between items-center max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => setCurrentSection(prev => Math.max(0, prev - 1))}
            className={`group px-4 md:px-6 py-2 md:py-3 text-base md:text-lg font-display transition-all ${
              currentSection === 0
                ? 'opacity-0 pointer-events-none'
                : `text-${themeColor} hover:text-${themeColor}`
            }`}
          >
            <span>Previous</span>
            <pre className={`absolute -bottom-2 left-0 text-[8px] text-${themeColor}/40 group-hover:text-${themeColor}/60`}>
              ◄──
            </pre>
          </button>

          {currentSection === sectionNames.length - 1 ? (
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className={`group flex items-center gap-2 bg-${themeColor} text-garden-dark px-6 md:px-8 py-3 md:py-4 text-lg md:text-xl font-display hover:bg-${themeColor} transition-colors pixel-corners relative`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-garden-dark border-t-transparent" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 md:w-6 md:h-6" />
                  Submit
                </>
              )}
              <pre className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-${themeColor}/60 group-hover:text-${themeColor}`}>
                ▲▲▲
              </pre>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentSection(prev => Math.min(sectionNames.length - 1, prev + 1))}
              className={`group flex items-center gap-2 text-${themeColor} hover:text-${themeColor} px-4 md:px-6 py-2 md:py-3 text-base md:text-lg font-display transition-all`}
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
              <pre className={`absolute -bottom-2 right-0 text-[8px] text-${themeColor}/40 group-hover:text-${themeColor}/60`}>
                ──►
              </pre>
            </button>
          )}
        </div>

        <div className={`fixed bottom-4 left-4 text-${themeColor}/20`}>
          <Terminal className="w-5 h-5 md:w-6 md:h-6" />
        </div>
      </div>
    </div>
  );
}