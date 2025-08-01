// src/components/admin/QuestionFormModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { X, AlertCircle, Plus, Trash2, Eye, EyeOff, ListFilter, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ApplicationQuestion, VisibilityRules, VisibilityRule } from '../../types/application'; // Corrected import path
import { APPLICATION_SECTION_ORDER } from '../../config/applicationConfig'; // For order_number logic
// --- ADDED DND IMPORTS ---
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
// --- END ADDED DND IMPORTS ---

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
  visibility_rules?: VisibilityRules | null; // Now an object
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

const VISIBILITY_OPERATORS: VisibilityRule['operator'][] = ['equals', 'not_equals', 'contains', 'not_contains'];


interface RuleUI extends VisibilityRule {
  ui_id: string; // For React key
}


export function QuestionFormModal({ question, allQuestions, onClose }: QuestionFormModalProps) {
  const [formData, setFormData] = useState(() => ({
    text: '',
    type: QUESTION_TYPES[0], // Default type
    options: [] as string[],
    required: null as boolean | null, // Default to null
    section: QUESTION_SECTIONS[0], // Default section
    file_storage_bucket: '',
  }));

  // --- State for Rule Builder ---
  const [visibilityType, setVisibilityType] = useState<'alwaysVisible' | 'alwaysHidden' | 'conditional'>('alwaysVisible');
  const [conditionalLogic, setConditionalLogic] = useState<'AND' | 'OR'>('AND');
  const [rules, setRules] = useState<RuleUI[]>([]);
  // --- End State for Rule Builder ---

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = question !== null && question.id !== '';

  useEffect(() => {
    if (question) {
      console.log("QuestionFormModal: Initializing with provided question object", { question, isActuallyEditing: isEditing });
      
      let initialOptions: string[] = [];
      if ((question.type === 'radio' || question.type === 'checkbox') && Array.isArray(question.options)) {
        initialOptions = question.options;
      }

      setFormData({
        text: question.text || '',
        type: question.type || QUESTION_TYPES[0],
        options: initialOptions,
        required: question.required ?? null,
        section: question.section || QUESTION_SECTIONS[0],
        file_storage_bucket: question.file_storage_bucket || '',
      });

      // --- Parse visibility_rules ---
      const existingRules = question.visibility_rules;
      if (existingRules && typeof existingRules === 'object') {
        if (existingRules.visible === false) {
          setVisibilityType('alwaysHidden');
          setConditionalLogic('AND');
          setRules([]);
        } else if (existingRules.rules && Array.isArray(existingRules.rules) && existingRules.rules.length > 0) {
          setVisibilityType('conditional');
          setConditionalLogic(existingRules.condition === 'OR' ? 'OR' : 'AND');
          setRules(existingRules.rules.map((rule, index) => ({
            ...rule,
            ui_id: `rule-${Date.now()}-${index}` // Simple unique ID
          })));
        } else { // Includes { visible: true } or empty object {} or other invalid states
          setVisibilityType('alwaysVisible');
          setConditionalLogic('AND');
          setRules([]);
        }
      } else { // Null, undefined, or non-object (e.g. old string format if any survived)
        setVisibilityType('alwaysVisible');
        setConditionalLogic('AND');
        setRules([]);
      }
      // --- End Parse visibility_rules ---

    } else {
       console.log("QuestionFormModal: Initializing for brand new question (no pre-fill)");
       setFormData({
         text: '',
         type: QUESTION_TYPES[0],
         options: [],
         required: null,
         section: QUESTION_SECTIONS[0],
         file_storage_bucket: '',
       });
       // Reset rule builder state for new question
       setVisibilityType('alwaysVisible');
       setConditionalLogic('AND');
       setRules([]);
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
            const updatedOptions = (name === 'type' && value !== 'radio' && value !== 'checkbox') ? [] : prev.options;
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

  // --- ADDED DND HANDLER FOR OPTIONS ---
  const onOptionsDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result;

    if (!destination) {
      return;
    }

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Optimistic UI Update - immediately update the state to prevent jittering
    const newOptions = Array.from(formData.options);
    const [movedItem] = newOptions.splice(source.index, 1);
    newOptions.splice(destination.index, 0, movedItem);

    // Use requestAnimationFrame to ensure the drag-and-drop library finishes its cleanup animations
    requestAnimationFrame(() => {
      setFormData(prev => ({ ...prev, options: newOptions }));
    });
  }, [formData.options]);
  // --- END DND HANDLER FOR OPTIONS ---

  // --- Rule Builder Handlers ---
  const handleAddRule = () => {
    setRules(prev => [...prev, {
      ui_id: `rule-${Date.now()}-${prev.length}`,
      question_id: '',
      operator: 'equals',
      answer: ''
    }]);
  };

  const handleRuleChange = (ui_id: string, field: keyof Omit<RuleUI, 'ui_id'>, value: string) => {
    setRules(prev => prev.map(r => r.ui_id === ui_id ? { ...r, [field]: value } : r));
  };

  const handleRemoveRule = (ui_id: string) => {
    setRules(prev => prev.filter(r => r.ui_id !== ui_id));
  };
  // --- End Rule Builder Handlers ---


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log("QuestionFormModal: Form submitted", { isEditing, formData, visibilityType, conditionalLogic, rules });

    const typesThatUseOptions: ApplicationQuestion['type'][] = ['radio', 'checkbox'];

    const finalOptions = typesThatUseOptions.includes(formData.type)
        ? formData.options.map(opt => opt.trim()).filter(opt => opt !== '')
        : null;

    if (typesThatUseOptions.includes(formData.type) && (!finalOptions || finalOptions.length === 0)) {
        setError(`${formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} questions must have at least one non-empty option.`);
        setLoading(false);
        return;
    }

    // --- Serialize Visibility Rules ---
    let finalVisibilityRules: VisibilityRules | null = null;
    if (visibilityType === 'alwaysHidden') {
      finalVisibilityRules = { visible: false };
    } else if (visibilityType === 'conditional') {
      if (rules.length === 0) {
        // If conditional is selected but no rules, treat as always visible. Or show error.
        // For now, let's treat as always visible to avoid blocking save.
        // Consider adding validation to ensure at least one rule if 'conditional' is chosen.
        finalVisibilityRules = { visible: true }; // Or null to let backend default
      } else {
        const processedRules = rules
          .filter(r => r.question_id && r.operator && r.answer.trim() !== '') // Basic validation
          .map(r => ({
            question_id: r.question_id,
            operator: r.operator as VisibilityRule['operator'],
            answer: r.answer,
          }));
        if (processedRules.length > 0) {
          finalVisibilityRules = {
            condition: conditionalLogic,
            rules: processedRules,
          };
        } else {
          // No valid rules, so treat as always visible
           finalVisibilityRules = { visible: true };
        }
      }
    } else { // 'alwaysVisible'
      finalVisibilityRules = { visible: true }; // Or null, depending on how backend handles absence
    }
    // --- End Serialize Visibility Rules ---

    try {
      const questionDataPayload = {
        text: formData.text,
        type: formData.type,
        options: finalOptions, 
        required: formData.required, 
        section: formData.section,
        file_storage_bucket: formData.file_storage_bucket || null, 
        visibility_rules: finalVisibilityRules,
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
                className="relative z-[101] bg-[var(--color-furface-modal,theme(colors.gray.800))] p-6 rounded-sm shadow-xl max-w-2xl w-full border border-[var(--color-border)] max-h-[90vh] overflow-y-auto" // Increased max-width
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
                             className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] text-[var(--color-text-primary)] font-mono"
                         >
                            {QUESTION_TYPES.map(typeOpt => (
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
                            <DragDropContext onDragEnd={onOptionsDragEnd}>
                                <Droppable droppableId="options-list" type="OPTION">
                                    {(provided, snapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={`space-y-2 ${snapshot.isDraggingOver ? 'bg-[var(--color-bg-surface-hover)]' : ''}`}
                                        >
                                            {formData.options.map((option, index) => (
                                                <Draggable key={`option-${index}`} draggableId={`option-${index}`} index={index}>
                                                    {(providedDraggable, snapshotDraggable) => (
                                                        <div
                                                            ref={providedDraggable.innerRef}
                                                            {...providedDraggable.draggableProps}
                                                                                                                         className={`flex items-center gap-2 p-2 rounded-md border ${
                                                                 snapshotDraggable.isDragging 
                                                                     ? 'shadow-lg bg-[var(--color-accent-primary-muted)] border-[var(--color-accent-primary)]' 
                                                                     : 'border-[var(--color-border)] bg-[var(--color-input-bg)]'
                                                             } transition-all`}
                                                        >
                                                            <div
                                                                {...providedDraggable.dragHandleProps}
                                                                className="flex-shrink-0 p-1 cursor-grab hover:bg-[var(--color-bg-surface-hover)] rounded"
                                                                title="Drag to reorder"
                                                            >
                                                                <GripVertical className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                                                            </div>
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
                                                                className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors"
                                                                aria-label="Remove option"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
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
                             className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] text-[var(--color-text-primary)] font-mono"
                          >
                            {QUESTION_SECTIONS.map(sectionOpt => (
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
                             className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] text-[var(--color-text-primary)] font-mono"
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

                    {/* --- Visibility Rules UI --- */}
                    <div className="pt-2 space-y-3 border-t border-[var(--color-border)] mt-4">
                        <h3 className="text-sm font-medium text-[var(--color-text-primary)] font-mono pt-3 flex items-center">
                            <ListFilter className="w-4 h-4 mr-2 text-[var(--color-text-secondary)]" />
                            Visibility Rules
                        </h3>
                        <div className="space-y-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="visibilityType"
                                    value="alwaysVisible"
                                    checked={visibilityType === 'alwaysVisible'}
                                    onChange={() => setVisibilityType('alwaysVisible')}
                                    className="form-radio text-emerald-500 bg-[var(--color-input-bg)] border-[var(--color-border)] focus:ring-emerald-400"
                                />
                                <Eye className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm text-[var(--color-text-secondary)] font-mono">Always Visible</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="visibilityType"
                                    value="alwaysHidden"
                                    checked={visibilityType === 'alwaysHidden'}
                                    onChange={() => setVisibilityType('alwaysHidden')}
                                    className="form-radio text-red-500 bg-[var(--color-input-bg)] border-[var(--color-border)] focus:ring-red-400"
                                />
                                <EyeOff className="w-4 h-4 text-red-500" />
                                <span className="text-sm text-[var(--color-text-secondary)] font-mono">Always Hidden</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="visibilityType"
                                    value="conditional"
                                    checked={visibilityType === 'conditional'}
                                    onChange={() => setVisibilityType('conditional')}
                                    className="form-radio text-blue-500 bg-[var(--color-input-bg)] border-[var(--color-border)] focus:ring-blue-400"
                                />
                                <ListFilter className="w-4 h-4 text-blue-500" />
                                <span className="text-sm text-[var(--color-text-secondary)] font-mono">Conditional Visibility</span>
                            </label>
                        </div>

                        {visibilityType === 'conditional' && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="p-3 space-y-3 border border-[var(--color-border-accent)] rounded-md bg-[var(--color-bg-surface-raised)] mt-2"
                            >
                                <div className="flex items-center space-x-3">
                                    <label className="text-xs font-medium text-[var(--color-text-secondary)] font-mono">Show if:</label>
                                    <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="conditionalLogic"
                                            value="AND"
                                            checked={conditionalLogic === 'AND'}
                                            onChange={() => setConditionalLogic('AND')}
                                            className="form-radio text-blue-500 bg-[var(--color-input-bg)] border-[var(--color-border)] focus:ring-blue-400"
                                        />
                                        <span className="text-xs text-[var(--color-text-secondary)] font-mono">ALL rules match (AND)</span>
                                    </label>
                                    <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="conditionalLogic"
                                            value="OR"
                                            checked={conditionalLogic === 'OR'}
                                            onChange={() => setConditionalLogic('OR')}
                                            className="form-radio text-blue-500 bg-[var(--color-input-bg)] border-[var(--color-border)] focus:ring-blue-400"
                                        />
                                        <span className="text-xs text-[var(--color-text-secondary)] font-mono">ANY rule matches (OR)</span>
                                    </label>
                                </div>

                                {rules.map((rule, index) => (
                                    <div key={rule.ui_id} className="p-2 space-y-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-surface)]">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                                            <div>
                                                <label htmlFor={`rule-question-${rule.ui_id}`} className="block text-xs font-medium text-[var(--color-text-secondary)] font-mono mb-0.5">Target Question</label>
                                                                                                 <select
                                                     id={`rule-question-${rule.ui_id}`}
                                                     value={rule.question_id}
                                                     onChange={(e) => handleRuleChange(rule.ui_id, 'question_id', e.target.value)}
                                                     className="w-full px-2 py-1.5 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] text-[var(--color-text-primary)] font-mono text-xs"
                                                 >
                                                    <option value="">Select a question...</option>
                                                    {allQuestions.filter(q => q.id !== question?.id && q.type !== 'markdown_text').map(q => (
                                                        <option key={q.id} value={q.id} title={q.text}>
                                                            {q.text.substring(0, 50)}{q.text.length > 50 ? '...' : ''} (ID: ...{q.id.slice(-6)})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor={`rule-operator-${rule.ui_id}`} className="block text-xs font-medium text-[var(--color-text-secondary)] font-mono mb-0.5">Operator</label>
                                                                                                 <select
                                                     id={`rule-operator-${rule.ui_id}`}
                                                     value={rule.operator}
                                                     onChange={(e) => handleRuleChange(rule.ui_id, 'operator', e.target.value)}
                                                     className="w-full px-2 py-1.5 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] text-[var(--color-text-primary)] font-mono text-xs"
                                                 >
                                                    {VISIBILITY_OPERATORS.map(op => (
                                                        <option key={op} value={op}>{op}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex items-end gap-1">
                                                <div className="flex-grow">
                                                    <label htmlFor={`rule-answer-${rule.ui_id}`} className="block text-xs font-medium text-[var(--color-text-secondary)] font-mono mb-0.5">Answer</label>
                                                    <input
                                                        type="text"
                                                        id={`rule-answer-${rule.ui_id}`}
                                                        value={rule.answer}
                                                        onChange={(e) => handleRuleChange(rule.ui_id, 'answer', e.target.value)}
                                                        className="w-full px-2 py-1.5 border border-[var(--color-border)] rounded-md bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-xs"
                                                        placeholder="Expected answer"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRule(rule.ui_id)}
                                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors self-end mb-[1px]" // Adjust margin to align with input
                                                    aria-label="Remove rule"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddRule}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors border border-[var(--color-border)]"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Rule
                                </button>
                                {rules.length === 0 && (
                                     <p className="text-xs text-[var(--color-text-tertiary)] font-mono italic">
                                        Add at least one rule for conditional visibility. If no rules are added, question will default to being visible.
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </div>
                    {/* --- End Visibility Rules UI --- */}

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                         <button 
                            type="button"
                            onClick={() => onClose(false)} 
                            disabled={loading}
                            className="px-4 py-2 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] font-mono transition-colors disabled:opacity-50"
                        >
                            Cancel
                         </button>
                         <button 
                            type="submit" 
                            disabled={loading}
                            className="px-4 py-2 rounded-sm bg-emerald-800 text-white hover:bg-emerald-700 font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
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