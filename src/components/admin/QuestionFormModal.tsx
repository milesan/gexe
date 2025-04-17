// src/components/admin/QuestionFormModal.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Re-using the interface - ideally this would be in a shared types file
interface ApplicationQuestion {
  id: string;
  order_number: number;
  text: string;
  type: 'text' | 'textarea' | 'radio' | 'tel'; // 'file' removed
  options?: string[];
  required: boolean;
  section: 'intro' | 'personal' | 'stay' | 'philosophy';
  created_at: string;
  updated_at: string;
  file_storage_bucket?: string;
}

interface QuestionFormModalProps {
  question: ApplicationQuestion | null; // null for Add mode, object for Edit mode
  allQuestions: ApplicationQuestion[]; // Needed to calculate next order_number
  onClose: (refresh?: boolean) => void;
}

// Define allowed types and sections
const QUESTION_TYPES: ApplicationQuestion['type'][] = ['text', 'textarea', 'radio', 'tel']; // 'file' removed
const QUESTION_SECTIONS: ApplicationQuestion['section'][] = ['intro', 'personal', 'stay', 'philosophy'];

export function QuestionFormModal({ question, allQuestions, onClose }: QuestionFormModalProps) {
  const [formData, setFormData] = useState({
    text: '',
    type: QUESTION_TYPES[0], // Default type
    options: [] as string[], // Changed to string array
    required: false,
    section: QUESTION_SECTIONS[0], // Default section
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = question !== null;

  useEffect(() => {
    if (isEditing && question) {
      console.log("QuestionFormModal: Initializing edit mode", { question });
      let initialOptions: string[] = [];
      // Safely parse options
      if (question.type === 'radio' && Array.isArray(question.options)) {
        initialOptions = question.options.filter(opt => typeof opt === 'string');
      } else if (typeof question.options === 'string') {
        // Attempt to parse if it was somehow saved as a string (legacy?)
        try {
            const parsed = JSON.parse(question.options);
            if (Array.isArray(parsed)) {
                initialOptions = parsed.filter(opt => typeof opt === 'string');
            }
        } catch { /* Ignore parse errors, default to empty */ }
      }

      setFormData({
        text: question.text || '',
        type: question.type || QUESTION_TYPES[0],
        options: initialOptions,
        required: question.required || false,
        section: question.section || QUESTION_SECTIONS[0],
      });
    } else {
       console.log("QuestionFormModal: Initializing add mode");
       // Reset for add mode
       setFormData({
         text: '',
         type: QUESTION_TYPES[0],
         options: [], // Reset to empty array
         required: false,
         section: QUESTION_SECTIONS[0],
       });
    }
  }, [question, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        // Handle checkbox specifically because its value is in 'checked' prop
        const { checked } = e.target as HTMLInputElement;
         setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
         // If changing type away from radio, clear options
         const newOptions = name === 'type' && value !== 'radio' ? [] : formData.options;
         setFormData(prev => ({ ...prev, [name]: value, options: newOptions }));
    }
  };

  // --- New handlers for dynamic options ---
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    setFormData(prev => ({ ...prev, options: [...prev.options, ''] }));
  };

  const removeOption = (index: number) => {
    const newOptions = formData.options.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, options: newOptions }));
  };
  // --- End new handlers ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log("QuestionFormModal: Form submitted", { isEditing, formData });

    // Filter out empty options before submitting
    const finalOptions = formData.type === 'radio'
        ? formData.options.map(opt => opt.trim()).filter(opt => opt !== '')
        : null;

    // Basic validation: Ensure radio has at least one non-empty option if selected
    if (formData.type === 'radio' && (!finalOptions || finalOptions.length === 0)) {
        setError("Radio questions must have at least one non-empty option.");
        setLoading(false);
        return;
    }

    try {
      if (isEditing && question) {
        // --- UPDATE ---
        console.log("QuestionFormModal: Updating question", { id: question.id });
        const { error: updateError } = await supabase
          .from('application_questions')
          .update({
            text: formData.text,
            type: formData.type,
            options: finalOptions, // Use the filtered array
            required: formData.required,
            section: formData.section,
            updated_at: new Date().toISOString(), // Explicitly set updated_at
          })
          .match({ id: question.id });

        if (updateError) throw updateError;
        console.log("QuestionFormModal: Update successful");
        onClose(true); // Close modal and refresh list
      } else {
        // --- INSERT ---
        console.log("QuestionFormModal: Inserting new question");
        // Calculate the next order_number
        const maxOrder = allQuestions.reduce((max, q) => Math.max(max, q.order_number), 0);
        const nextOrderNumber = maxOrder + 1000;
        console.log("QuestionFormModal: Calculated next order_number", { maxOrder, nextOrderNumber });

        const { error: insertError } = await supabase
          .from('application_questions')
          .insert([
            {
              text: formData.text,
              type: formData.type,
              options: finalOptions, // Use the filtered array
              required: formData.required,
              section: formData.section,
              order_number: nextOrderNumber,
              // created_at and updated_at will be set by default in Supabase
            },
          ]);
          
        if (insertError) throw insertError;
        console.log("QuestionFormModal: Insert successful");
        onClose(true); // Close modal and refresh list
      }
    } catch (err: any) {
      console.error(`QuestionFormModal: Error ${isEditing ? 'updating' : 'inserting'} question:`, err);
      setError(err.message || `Failed to ${isEditing ? 'update' : 'add'} question`);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <AnimatePresence>
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => onClose(false)} // Close on backdrop click
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative z-[101] bg-[var(--color-furface-modal,theme(colors.gray.800))] p-6 rounded-lg shadow-xl max-w-xl w-full border border-[var(--color-border)] max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-display font-light text-[var(--color-text-primary)]">
                    {isEditing ? 'Edit Question' : 'Add New Question'}
                    </h2>
                    <button onClick={() => onClose(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm flex items-center gap-2 font-mono">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{error}</span>
                     </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Text */}
                    <div>
                        <label htmlFor="text" className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono mb-1">Question Text</label>
                        <textarea
                            id="text"
                            name="text"
                            rows={3}
                            required
                            value={formData.text}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono"
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label htmlFor="type" className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono mb-1">Type</label>
                        <select
                            id="type"
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-furface-modal,theme(colors.gray.800))] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono [&>option]:bg-[var(--color-furface-modal)] [&>option]:text-white"
                        >
                            {QUESTION_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                     {/* Options (Conditional List) */}
                    {formData.type === 'radio' && (
                         <div className="space-y-3">
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono">Options</label>
                            {formData.options.map((option, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => handleOptionChange(index, e.target.value)}
                                        placeholder={`Option ${index + 1}`}
                                        className="flex-grow px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeOption(index)}
                                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors"
                                        aria-label="Remove option"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addOption}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors border border-[var(--color-border)]"
                            >
                                <Plus className="w-4 h-4" />
                                Add Option
                            </button>
                        </div>
                    )}


                    {/* Section */}
                    <div>
                         <label htmlFor="section" className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono mb-1">Section</label>
                        <select
                            id="section"
                            name="section"
                            value={formData.section}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border bg-[var(--color-furface-modal,theme(colors.gray.800))] rounded-md bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono [&>option]:bg-[var(--color-furface-modal)] [&>option]:text-white"
                         >
                            {QUESTION_SECTIONS.map(section => (
                                <option key={section} value={section}>{section}</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Required */}
                    <div className="flex items-center">
                        <input
                            id="required"
                            name="required"
                            type="checkbox"
                            checked={formData.required}
                            onChange={handleChange}
                            className="h-4 w-4 text-emerald-600 border-[var(--color-border)] rounded focus:ring-emerald-500"
                        />
                        <label htmlFor="required" className="ml-2 block text-sm text-[var(--color-text-secondary)] font-mono">Required Question</label>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                         <button 
                            type="button"
                            onClick={() => onClose(false)} 
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] font-mono transition-colors disabled:opacity-50"
                        >
                            Cancel
                         </button>
                         <button 
                            type="submit" 
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]" // Added min-width for loading state
                        >
                             {loading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                                isEditing ? 'Save Changes' : 'Add Question'
                            )}
                         </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
     </AnimatePresence>,
     document.body
  );
} 