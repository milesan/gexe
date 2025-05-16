// src/components/admin/QuestionFormModal.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ApplicationQuestion } from '../../types/application'; // Corrected import path
import { APPLICATION_SECTION_ORDER } from '../../config/applicationConfig'; // For order_number logic

// Updated ApplicationQuestion interface (mirroring what should be in ../../types/application.ts)
/*
interface ApplicationQuestion {
  id: string; // uuid
  order_number: number; // float
  text: string;
  type: 'text' | 'radio' | 'date' | 'email' | 'tel' | 'file' | 'textarea' | 'password' | 'checkbox' | 'markdown_text'; // enum
  options?: string[] | null; // json, for radio and checklist options
  required?: boolean | null; // true/false/null
  section?: string | null; // text
  created_at: string;
  updated_at: string;
  file_storage_bucket?: string | null;
  visibility_rules?: string | null; // json, defining conditions
}
*/

interface QuestionFormModalProps {
  question: ApplicationQuestion | null; // null for Add mode, object for Edit mode
  allQuestions: ApplicationQuestion[]; // Needed to calculate next order_number
  onClose: (refresh?: boolean) => void;
  // APPLICATION_SECTION_ORDER might be passed if dynamic, or imported if static
}

// Define allowed types based on new schema
const QUESTION_TYPES: ApplicationQuestion['type'][] = [
    'text', 'textarea', 'radio', 'file', 'tel', 'date', 'email', 'password', 'checkbox', 'markdown_text'
];
// Sections are now dynamic strings, fetched or based on existing questions if needed for a select.
// For simplicity, we'll allow text input or use sections from existing questions.
// For the dropdown, let's derive from APPLICATION_SECTION_ORDER for consistency.
const QUESTION_SECTIONS: string[] = [...APPLICATION_SECTION_ORDER, 'Uncategorized'];


export function QuestionFormModal({ question, allQuestions, onClose }: QuestionFormModalProps) {
  const [formData, setFormData] = useState(() => ({
    text: '',
    type: QUESTION_TYPES[0], // Default type
    options: [] as string[],
    required: null as boolean | null, // Default to null
    section: QUESTION_SECTIONS[0], // Default section
    file_storage_bucket: '',
    visibility_rules: '{}', // Default to empty JSON object string
  }));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = question !== null && question.id !== '';

  useEffect(() => {
    if (question) {
      console.log("QuestionFormModal: Initializing with provided question object", { question, isActuallyEditing: isEditing });
      
      let initialOptions: string[] = [];
      // Ensure options is an array before trying to use array methods
      if (question.type === 'radio' && Array.isArray(question.options)) {
        initialOptions = question.options;
      }

      setFormData({
        text: question.text || '',
        type: question.type || QUESTION_TYPES[0],
        options: initialOptions,
        required: question.required ?? null, // Use nullish coalescing for required
        section: question.section || QUESTION_SECTIONS[0],
        file_storage_bucket: question.file_storage_bucket || '',
        visibility_rules: JSON.stringify(question.visibility_rules || {}),
      });
    } else {
       console.log("QuestionFormModal: Initializing for brand new question (no pre-fill)");
       // Reset to default for new question
       setFormData({
         text: '',
         type: QUESTION_TYPES[0],
         options: [],
         required: null,
         section: QUESTION_SECTIONS[0],
         file_storage_bucket: '',
         visibility_rules: '{}',
       });
    }
  }, [question, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox' && name === 'temp_required_bool') { // Special handling if we use a boolean checkbox for required
        // This 'temp_required_bool' is hypothetical. We'll use a select for 'required'.
    } else if (name === "required") { // Handle select for 'required'
        let actualValue: boolean | null;
        if (value === "true") actualValue = true;
        else if (value === "false") actualValue = false;
        else actualValue = null;
        setFormData(prev => ({ ...prev, required: actualValue }));
    }
    else {
         setFormData(prev => {
            const updatedOptions = (name === 'type' && value !== 'radio') ? [] : prev.options;
            return {
                ...prev,
                [name]: value,
                options: updatedOptions,
            };
        });
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log("QuestionFormModal: Form submitted", { isEditing, formData });

    const typesThatUseOptions: ApplicationQuestion['type'][] = ['radio', 'checkbox']; // Define types that use the options array

    const finalOptions = typesThatUseOptions.includes(formData.type)
        ? formData.options.map(opt => opt.trim()).filter(opt => opt !== '')
        : null;

    // Updated validation to include checkbox and make message dynamic
    if (typesThatUseOptions.includes(formData.type) && (!finalOptions || finalOptions.length === 0)) {
        setError(`${formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} questions must have at least one non-empty option.`);
        setLoading(false);
        return;
    }

    try {
        let visibilityRulesJson: any = null;
        if (formData.visibility_rules && formData.visibility_rules.trim() !== "") {
            try {
                visibilityRulesJson = JSON.parse(formData.visibility_rules);
            } catch (parseError) {
                setError("Visibility Rules JSON is invalid. Please check the syntax.");
                setLoading(false);
                console.error("JSON Parse Error for visibility_rules:", parseError);
                return;
            }
        }


      const questionDataPayload = {
        text: formData.text,
        type: formData.type,
        options: finalOptions, 
        required: formData.required, 
        section: formData.section,
        file_storage_bucket: formData.file_storage_bucket || null, 
        visibility_rules: visibilityRulesJson, 
        updated_at: new Date().toISOString(),
        // order_number will be handled below
      };

      if (isEditing && question) {
        console.log("QuestionFormModal: Updating question", { id: question.id });

        let finalOrderNumber = question.order_number; // Default to original order number

        // Check if section has changed
        if (formData.section !== question.section) {
            console.log("QuestionFormModal: Section changed during edit. Recalculating order_number.", { oldSection: question.section, newSection: formData.section });
            const currentSection = formData.section;
            const sectionIndex = APPLICATION_SECTION_ORDER.indexOf(currentSection as typeof APPLICATION_SECTION_ORDER[number]);
            const sectionOrderPrefix = (sectionIndex !== -1 ? sectionIndex + 1 : APPLICATION_SECTION_ORDER.length + 1) * 10000;

            const questionsInNewSection = allQuestions.filter(q => q.section === currentSection && q.id !== question.id); // Exclude the question being edited
            
            let maxOrderWithinNewSection = 0;
            if (questionsInNewSection.length > 0) {
                maxOrderWithinNewSection = questionsInNewSection.reduce((max, q) => Math.max(max, Number(q.order_number) || 0), 0);
            }
            
            if (maxOrderWithinNewSection === 0 || Math.floor(maxOrderWithinNewSection / 10000) !== Math.floor(sectionOrderPrefix / 10000)) {
                finalOrderNumber = sectionOrderPrefix + 100;
            } else {
                finalOrderNumber = maxOrderWithinNewSection + 100;
            }
            console.log("QuestionFormModal: Recalculated order_number for new section", { finalOrderNumber });
        }

        const updatePayload = {
            ...questionDataPayload,
            order_number: finalOrderNumber // Use original or recalculated order_number
        };

        const { error: updateError } = await supabase
          .from('application_questions_2') 
          .update(updatePayload)
          .match({ id: question.id });

        if (updateError) throw updateError;
        console.log("QuestionFormModal: Update successful");
        onClose(true);
      } else {
        console.log("QuestionFormModal: Inserting new question");
        
        // New order_number logic
        const currentSection = formData.section;
        const sectionIndex = APPLICATION_SECTION_ORDER.indexOf(currentSection as typeof APPLICATION_SECTION_ORDER[number]);
        // Default to 0 for sectionOrderPrefix if section not in defined order, or handle as error/default section.
        // For "Uncategorized" or other non-standard, could use a high prefix or specific handling.
        // Let's assume sections in formData.section are expected to be in APPLICATION_SECTION_ORDER for now.
        // If sectionIndex is -1 (not found), it implies it's a new/uncategorized section.
        // We'll use a very high prefix for these, or you could assign a default (e.g. last index + 1)
        const sectionOrderPrefix = (sectionIndex !== -1 ? sectionIndex + 1 : APPLICATION_SECTION_ORDER.length + 1) * 10000;

        const questionsInSameSection = allQuestions.filter(q => q.section === currentSection);
        
        let maxOrderWithinSection = 0;
        if (questionsInSameSection.length > 0) {
            // Ensure order_number is treated as number before Math.max
            maxOrderWithinSection = questionsInSameSection.reduce((max, q) => Math.max(max, Number(q.order_number) || 0), 0);
        }
        
        // If maxOrderWithinSection is 0 (empty section or all order_numbers are 0/null/NaN),
        // start with sectionOrderPrefix + 100.
        // Otherwise, increment from the max found.
        // Crucially, if maxOrderWithinSection is already section prefixed (e.g. 20500), we just add 100.
        // If it's NOT (e.g. old data or error, value is like 500), we should use the prefix.
        let nextOrderNumber;
        if (maxOrderWithinSection === 0 || Math.floor(maxOrderWithinSection / 10000) !== Math.floor(sectionOrderPrefix / 10000)) {
            // Section is effectively empty or existing orders are not in the new system for this section
            nextOrderNumber = sectionOrderPrefix + 100;
        } else {
            nextOrderNumber = maxOrderWithinSection + 100;
        }

        console.log("QuestionFormModal: Calculated next order_number", { currentSection, sectionIndex, sectionOrderPrefix, maxOrderWithinSection, nextOrderNumber });

        const { error: insertError } = await supabase
          .from('application_questions_2') // Use new table name
          .insert([
            {
              ...questionDataPayload,
              order_number: nextOrderNumber,
              // created_at will be set by Supabase
            },
          ]);
          
        if (insertError) throw insertError;
        console.log("QuestionFormModal: Insert successful");
        onClose(true);
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
            onClick={() => onClose(false)}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative z-[101] bg-[var(--color-furface-modal,theme(colors.gray.800))] p-6 rounded-lg shadow-xl max-w-2xl w-full border border-[var(--color-border)] max-h-[90vh] overflow-y-auto" // Increased max-width
                onClick={(e) => e.stopPropagation()}
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
                            {QUESTION_TYPES.map(typeOpt => ( // Renamed 'type' to 'typeOpt' to avoid conflict
                                <option key={typeOpt} value={typeOpt}>{typeOpt}</option>
                            ))}
                        </select>
                    </div>

                     {/* Options (Conditional List) */}
                    {(formData.type === 'radio' || formData.type === 'checkbox') && (
                         <div className="space-y-3 p-3 border border-[var(--color-border-accent)] rounded-md">
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono">
                                Options for {formData.type === 'radio' ? 'Radio' : 'Checkbox'} (each becomes a choice)
                            </label>
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
                            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-furface-modal,theme(colors.gray.800))] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono [&>option]:bg-[var(--color-furface-modal)] [&>option]:text-white"
                         >
                            {QUESTION_SECTIONS.map(sectionOpt => ( // Renamed 'section' to 'sectionOpt'
                                <option key={sectionOpt} value={sectionOpt}>{sectionOpt}</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Required */}
                    <div>
                        <label htmlFor="required" className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono mb-1">Required</label>
                        <select
                            id="required"
                            name="required"
                            value={formData.required === null ? "null" : String(formData.required)}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-furface-modal,theme(colors.gray.800))] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono [&>option]:bg-[var(--color-furface-modal)] [&>option]:text-white"
                        >
                            <option value="null">Not Set</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                        </select>
                    </div>

                    {/* File Storage Bucket */}
                    <div>
                        <label htmlFor="file_storage_bucket" className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono mb-1">
                            File Storage Bucket (Optional)
                        </label>
                        <input
                            type="text"
                            id="file_storage_bucket"
                            name="file_storage_bucket"
                            value={formData.file_storage_bucket}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono"
                            placeholder="e.g., application-images"
                        />
                        <p className="mt-1 text-xs text-[var(--color-text-tertiary)] font-mono">
                            If type is 'file', specify the Supabase storage bucket name here.
                        </p>
                    </div>

                    {/* Visibility Rules */}
                    <div className="pt-2 space-y-2 border-t border-[var(--color-border)] mt-4">
                        <h3 className="text-sm font-medium text-[var(--color-text-primary)] font-mono pt-3">Visibility Rules (JSON)</h3>
                        <label htmlFor="visibility_rules" className="block text-xs font-medium text-[var(--color-text-secondary)] font-mono mb-1">
                            Define conditions for showing this question (e.g., {"{\"rules\": [{\"question_id\": \"some-uuid\", \"answer\": \"Yes\"}], \"condition\": \"AND\"}"} or {"{\"visible\": false}"} )
                        </label>
                        <textarea
                            id="visibility_rules"
                            name="visibility_rules"
                            rows={5}
                            value={formData.visibility_rules}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-sm"
                            placeholder='Enter JSON, e.g., {"visible": true}'
                        />
                        <p className="mt-1 text-xs text-[var(--color-text-tertiary)] font-mono">
                           If empty or invalid JSON, it might default to always visible or as per backend logic.
                           Example for simple hide: {"{\"visible\": false}"}
                        </p>
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
                            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
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