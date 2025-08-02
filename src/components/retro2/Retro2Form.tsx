import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RetroQuestionField } from './RetroQuestionField';
import { Send, LogOut } from 'lucide-react';
import { AutosaveNotification } from '../AutosaveNotification';
import { useAutosave } from '../../hooks/useAutosave';
import type { ApplicationQuestion, VisibilityRules, VisibilityRule } from '../../types/application';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { SignUpHeader } from './SignUpHeader';

interface Props {
  questions: ApplicationQuestion[];
  onSubmit: (data: any) => void;
  initialData?: Record<string, any>;
}

// --- START: New Visibility Logic (replaces old isQuestionCurrentlyVisible) ---
const evaluateRule = (rule: VisibilityRule, formData: Record<string, any>): boolean => {
  const actualAnswer = formData[rule.question_id];
  const expectedAnswer = rule.answer;
  const operator = rule.operator || 'equals';

  switch (operator) {
    case 'equals':
      return actualAnswer === expectedAnswer;
    case 'not_equals':
      if (actualAnswer === undefined) {
        return false; // If the source question isn't answered, a "not_equals" condition shouldn't make this question visible.
      }
      return actualAnswer !== expectedAnswer;
    case 'contains':
      if (Array.isArray(actualAnswer)) return actualAnswer.includes(expectedAnswer);
      if (typeof actualAnswer === 'string' && typeof expectedAnswer === 'string') return actualAnswer.includes(expectedAnswer);
      return false;
    case 'not_contains':
      if (Array.isArray(actualAnswer)) return !actualAnswer.includes(expectedAnswer);
      if (typeof actualAnswer === 'string' && typeof expectedAnswer === 'string') return !actualAnswer.includes(expectedAnswer);
      return actualAnswer === undefined ? true : false; // If undefined, it doesn't contain it.
    default:
      console.warn(`Unsupported operator: ${operator}`);
      return false;
  }
};

const isQuestionCurrentlyVisible = (
  question: ApplicationQuestion,
  formData: Record<string, any>
): boolean => {
  const rules = question.visibility_rules;

  if (!rules) { return true; } // No rules object, visible.

  // If rules.rules array exists and is not empty, these determine visibility.
  if (rules.rules && rules.rules.length > 0) {
    if (rules.condition === 'OR') {
      return rules.rules.some(rule => evaluateRule(rule, formData));
    }
    return rules.rules.every(rule => evaluateRule(rule, formData)); // Default to AND
  }

  // If no rules.rules array, then rules.visible (if boolean) dictates overall visibility.
  // Otherwise, default to true (visible).
  if (typeof rules.visible === 'boolean') {
    return rules.visible;
  }

  return true; // Fallback: if no rules.rules and rules.visible isn't a boolean, make it visible.
};
// --- END: New Visibility Logic ---

export function Retro2Form({ questions, onSubmit, initialData }: Props) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { saveData, loadSavedData, showSaveNotification, setShowSaveNotification } = useAutosave();
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserEmail(user.email || null);
      }
    };
    fetchUser();
  }, []);

  const sortedQuestionsProp = useMemo(() => {
    return [...questions].sort((a, b) => {
      // Sort directly by order_number. Handle potential null/undefined order_number by defaulting to Infinity.
      const orderNumberA = a.order_number ?? Infinity;
      const orderNumberB = b.order_number ?? Infinity;
      return orderNumberA - orderNumberB;
    });
  }, [questions]);

  const currentVisibleQuestions = useMemo(() => {
    return sortedQuestionsProp.filter(q => isQuestionCurrentlyVisible(q, formData));
  }, [sortedQuestionsProp, formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormComplete(currentVisibleQuestions, formData)) {
      console.warn("Submit attempted but form is incomplete. Scrolling to first error.");
      const firstIncompleteQuestion = currentVisibleQuestions.find(question => {
        if (!question.required) return false;
        const value = formData[question.id];
        return Array.isArray(value) ? value.length === 0 : (value === undefined || value === '' || value === null);
      });
      if (firstIncompleteQuestion) {
        const elementId = `q-${firstIncompleteQuestion.id}`;
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const focusable = element.querySelector('input, textarea, select, button') as HTMLElement | null;
          if (focusable) focusable.focus({ preventScroll: true });
        }
      }
      return; 
    }
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('saved_applications').delete().eq('user_id', user.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  type QuestionFieldValue = any; // Could import QuestionValue from RetroQuestionField if it's exported
  const handleChange = (question_id: string, value: QuestionFieldValue) => {
    setFormData(prevFormData => {
      const updatedFormData = { ...prevFormData, [question_id]: value };
      saveData(updatedFormData);
      return updatedFormData;
    });
  };

  const isFormComplete = (activeQuestions: ApplicationQuestion[], currentFormData: Record<string, any>) => {
    return activeQuestions.every(question => {
      if (!question.required) return true;
      const value = currentFormData[question.id];
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== '' && value !== null;
    });
  };

  // --- START: Auto-scroll on tab functionality ---
  useEffect(() => {
    const handleFocusChange = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if the focused element is an input, textarea, or button within a question
      const questionContainer = target.closest('[id^="q-"]');
      if (!questionContainer) return;
      
      // Small delay to ensure the browser has completed the focus change
      setTimeout(() => {
        // Find the parent question container and scroll it into view
        const rect = questionContainer.getBoundingClientRect();
        const isFullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
        
        if (!isFullyVisible) {
          questionContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }, 100);
    };

    // Add focus listener to the document
    document.addEventListener('focusin', handleFocusChange);
    
    return () => {
      document.removeEventListener('focusin', handleFocusChange);
    };
  }, []);
  // --- END: Auto-scroll on tab functionality ---

  // --- START: Random Data Generation for Dev ---
  const isDevUser = currentUserEmail && /^redis213\+.*@gmail\.com$/.test(currentUserEmail);

  const generateRandomDataForQuestion = (question: ApplicationQuestion): any => {
    const randomString = (length = 8) => Math.random().toString(36).substring(2, 2 + length);
    const randomNumberString = (length = 10) => Math.random().toString().slice(2, 2 + length); // For tel/password
    const randomNumber = (max = 100) => Math.floor(Math.random() * max);

    switch (question.type) {
      case 'text':
        return randomString(10 + randomNumber(10)); // Shorter than textarea
      case 'textarea':
        return randomString(20 + randomNumber(30)); // Longer for textareas
      case 'email':
        return `${randomString()}@example.com`;
      case 'tel': // Generate a string of random numbers
        return randomNumberString(10);
      case 'password':
        return randomString(12);
      case 'radio': // Handles select-like behavior
        if (question.options && question.options.length > 0) {
          return question.options[randomNumber(question.options.length)];
        }
        return undefined; // No options, no value
      case 'checkbox': // Represents a single boolean checkbox
        return Math.random() > 0.5;
      case 'date': {
        const d = new Date();
        d.setDate(d.getDate() - randomNumber(365 * 2)); // Random date in the last 2 years
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
      }
      case 'arrival_date_selector': {
        // Generate a random future date as ISO string (mimicking a selected week start date)
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + randomNumber(180)); // Random date in next 6 months
        return futureDate.toISOString();
      }
      case 'file': // Skip file uploads
      case 'markdown_text': // Skip display text
        return undefined;
      default:
        // This default case should ideally not be hit if all ApplicationQuestion types are handled.
        // However, if new types are added to ApplicationQuestion and not here, it provides a fallback.
        console.warn(`[DevFill] Unhandled question type for random data: ${question.type} (ID: ${question.id}). Defaulting to short random string.`);
        return randomString(5);
    }
  };

  const handleFillRandomData = () => {
    if (!isDevUser) return;

    console.log("[DevFill] Filling form with random data for visible questions...");
    const updatedFormData = { ...formData };
    let changesMade = false;

    currentVisibleQuestions.forEach(question => {
      // Skip markdown display text
      if (question.type === 'markdown_text') return;

      const randomValue = generateRandomDataForQuestion(question);
      if (randomValue !== undefined) {
        updatedFormData[question.id] = randomValue;
        console.log(`[DevFill] Q: ${question.id} (${question.type}), Value:`, randomValue);
        changesMade = true;
      }
    });

    if (changesMade) {
      setFormData(updatedFormData);
      saveData(updatedFormData); // Also trigger autosave
      console.log("[DevFill] Random data applied.");
    } else {
      console.log("[DevFill] No applicable questions found to fill or no changes made.");
    }
  };
  // --- END: Random Data Generation for Dev ---

  return (
    <div className="bg-black text-retro-accent font-mono flex flex-col min-h-screen">
      <SignUpHeader />
      <div className="flex-grow pb-32">
        <div className="max-w-xl mx-auto px-4 pt-8 space-y-12">
          {currentVisibleQuestions.map((question, index) => {
            // --- START DIAGNOSTIC LOG ---
            if (question.id === "be989cfd-f09e-4185-ba84-dabb8846f24c" || question.type === 'markdown_text') {
              console.log('[Retro2Form] Processing question:', JSON.stringify(question));
            }
            // --- END DIAGNOSTIC LOG ---

            // If a question is of type 'markdown_text', render it here directly.
            if (question.type === 'markdown_text') {
              return (
                <div 
                  key={question.id} 
                  id={`q-${question.id}`} 
                  className="prose prose-invert prose-sm md:prose-base max-w-none my-6 p-3 font-mono text-retro-accent"
                >
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({node, ...props}) => <a {...props} className="underline hover:text-retro-accent/70" />
                    }}
                  >
                    {question.text}
                  </ReactMarkdown>
                </div>
              );
            }
            // For all other question types, use RetroQuestionField
            return (
              <div key={question.id} id={`q-${question.id}`}>
                <RetroQuestionField
                  question={question}
                  value={formData[question.id]}
                  onChange={(v: QuestionFieldValue) => handleChange(question.id, v)}
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
              className={`group flex items-center justify-center gap-2 px-6 py-3 text-lg transition-colors min-w-44 ${isSubmitting || !isFormComplete(currentVisibleQuestions, formData)
                ? 'bg-retro-accent/10 text-retro-accent cursor-pointer'
                : 'bg-retro-accent text-black hover:bg-accent-secondary'
              } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            {/* --- START: Dev Fill Button --- */}
            {isDevUser && (
              <button
                type="button"
                onClick={handleFillRandomData}
                className="ml-4 px-4 py-3 text-sm bg-purple-600/30 hover:bg-purple-500/50 text-purple-300 border border-purple-500"
                style={{
                  clipPath: `polygon(
                    0 4px, 4px 4px, 4px 0,
                    calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                    100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                    calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                    0 calc(100% - 4px)
                  )`
                }}
                title="Fill form with random data (Dev Only)"
              >
                Fill Random (Dev)
              </button>
            )}
            {/* --- END: Dev Fill Button --- */}
          </div>
        </div>
      </div>
    </div>
  );
}