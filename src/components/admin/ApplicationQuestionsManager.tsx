import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, AlertTriangle, ChevronDown, ChevronUp, BookOpen, GripVertical } from 'lucide-react';
import type { ApplicationQuestion } from '../../types/application'; // IMPORTANT: This type definition MUST be updated
// Import the actual modal component
import { QuestionFormModal } from './QuestionFormModal';
// --- ADDED DND IMPORTS ---
import { DragDropContext, Droppable, Draggable, type DropResult, type DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
// --- END ADDED DND IMPORTS ---
import { APPLICATION_SECTION_ORDER } from '../../config/applicationConfig'; // Added import

// Define the structure of a question based on your description
/*
interface ApplicationQuestion { // This is an example, actual type comes from import
    id: string;
    order_number: number;
    text: string;
    type: string; // was 'text' | 'textarea' | 'radio' | 'file' | 'tel'; now string for flexibility (e.g. 'markdown_text')
    options?: string[];
    required: boolean;
    section: string; // was 'intro' | 'personal' | 'stay' | 'philosophy'; now string for flexibility
    created_at: string;
    updated_at: string;
    file_storage_bucket?: string;
    visibility_rules?: string; // NEW FIELD (JSON string)
}
*/

export function ApplicationQuestionsManager() {
    // State hooks 
    const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<ApplicationQuestion | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    // TODO: Section intro feature needs re-evaluation as 'section_intro_markdown' is removed from ApplicationQuestion
    // const [editingIntroSection, setEditingIntroSection] = useState<string | null>(null);
    // const [currentIntroMarkdown, setCurrentIntroMarkdown] = useState('');

    // useEffect hook
    useEffect(() => {
        loadQuestions();
    }, []);

    // loadQuestions function
    const loadQuestions = async (isReorder: boolean = false) => {
        console.log("ApplicationQuestionsManager: Fetching questions...");
        if (!isReorder) setLoading(true); 
        setError(null);
        try {
            const { data, error: queryError } = await supabase
                .from('application_questions_2') // Updated table name
                .select('*')
                .order('section') // Order by section first for grouping
                .order('order_number', { ascending: true });

            if (queryError) throw queryError;
            
            setQuestions(data || []);
            console.log("ApplicationQuestionsManager: Questions fetched successfully", data?.length);
        } catch (err: any) {
            console.error('ApplicationQuestionsManager: Error loading questions:', err);
            setError(err.message || 'Failed to load questions');
        } finally {
            if (!isReorder) setLoading(false);
        }
    };

    // Group questions by section
    const groupedQuestions = useMemo(() => {
        if (!questions) return new Map<string, ApplicationQuestion[]>();
        // Ensure questions within each group are also sorted by order_number
        // This is crucial for the DND logic to work with the correct current order
        const sortedQuestions = [...questions].sort((a, b) => {
            if (a.section < b.section) return -1;
            if (a.section > b.section) return 1;
            return (a.order_number || 0) - (b.order_number || 0);
        });
        return sortedQuestions.reduce((acc, question) => {
            const sectionName = question.section || 'Uncategorized';
            if (!acc.has(sectionName)) {
                acc.set(sectionName, []);
            }
            acc.get(sectionName)!.push(question);
            return acc;
        }, new Map<string, ApplicationQuestion[]>());
    }, [questions]);

    const sectionNames = useMemo(() => {
        const keys = Array.from(groupedQuestions.keys());
        // Sort keys based on APPLICATION_SECTION_ORDER
        return keys.sort((a, b) => {
            const indexA = APPLICATION_SECTION_ORDER.indexOf(a as typeof APPLICATION_SECTION_ORDER[number]);
            const indexB = APPLICATION_SECTION_ORDER.indexOf(b as typeof APPLICATION_SECTION_ORDER[number]);
            // If a section isn't in our defined order, push it to the end.
            if (indexA === -1) return 1;
            if (indexB === -1) return 1;
            return indexA - indexB;
        });
    }, [groupedQuestions]);

    // --- ADDED DND HANDLER ---
    const onDragEnd = useCallback(async (result: DropResult) => {
        const { source, destination, draggableId } = result;
        console.log("ApplicationQuestionsManager: onDragEnd triggered", { source, destination, draggableId });

        if (!destination) {
            console.log("ApplicationQuestionsManager: No destination, drag cancelled.");
            return;
        }

        if (destination.droppableId === source.droppableId && destination.index === source.index) {
            console.log("ApplicationQuestionsManager: Dropped in the same place.");
            return;
        }
        setError(null); // Clear previous errors

        const draggedQuestion = questions.find(q => q.id === draggableId);
        if (!draggedQuestion) {
            console.error("ApplicationQuestionsManager: Dragged question not found in state!", { draggableId });
            setError("An internal error occurred: dragged question not found.");
            return;
        }

        let newOrderNumber: number;
        let newSection: string = draggedQuestion.section || ''; // Initialize with old section

        if (destination.droppableId === source.droppableId) {
            // --- REORDERING WITHIN THE SAME SECTION ---
            newSection = source.droppableId; // Section remains the same
            const itemsInSourceSection = Array.from(groupedQuestions.get(source.droppableId) || []);
            
            let reorderedInSection = Array.from(itemsInSourceSection);
            const [movedItem] = reorderedInSection.splice(source.index, 1);
            reorderedInSection.splice(destination.index, 0, movedItem);
            
            const prevQuestion = reorderedInSection[destination.index - 1];
            const nextQuestion = reorderedInSection[destination.index + 1];

            // Determine section base from one of the items in section, or dragged item if reliable
            const itemForSectionBase = prevQuestion || nextQuestion || draggedQuestion;
            const sectionBase = Math.floor((itemForSectionBase.order_number || 0) / 10000) * 10000;

            if (!prevQuestion) { // Dropped at the beginning
                const firstItemOrder = nextQuestion?.order_number || 0;
                let newLocalOrder = (firstItemOrder % 10000) / 2.0;
                // if halving results in 0, or not less than next, place it a defined step before
                // or set to a small default if section was empty/only one item
                if (newLocalOrder <= 0 || (sectionBase + newLocalOrder) >= firstItemOrder ) {
                     if (nextQuestion) { // if there is a next item
                        const typicalStep = 50;
                        if ((firstItemOrder % 10000) > typicalStep) newLocalOrder = (firstItemOrder % 10000) - typicalStep;
                        else if ((firstItemOrder % 10000) > 1 ) newLocalOrder = (firstItemOrder % 10000) / 2.0;
                        else newLocalOrder = (firstItemOrder % 10000) * 0.5; // make it smaller
                     } else { // Section became empty or was empty and this is the first
                        newLocalOrder = 100; // Default first item local order
                     }
                }
                if (newLocalOrder <= 0) newLocalOrder = 0.001; // Ensure positive, minimal step
                newOrderNumber = sectionBase + newLocalOrder;

            } else if (!nextQuestion) { // Dropped at the end
                newOrderNumber = (prevQuestion.order_number || 0) + 100.0;
            } else { // Dropped in between
                newOrderNumber = ((prevQuestion.order_number || 0) + (nextQuestion.order_number || 0)) / 2.0;
            }

        } else {
            // --- MOVING TO A DIFFERENT SECTION ---
            newSection = destination.droppableId;
            const destinationSectionName = destination.droppableId;
            
            // Get items currently in the destination section (these are the items around which we are dropping)
            const itemsInDestSectionCurrent = (groupedQuestions.get(destinationSectionName) || []).filter(q => q.id !== draggableId);

            // Create a temporary representation of the destination section *as if* the item was dropped there
            let tempDestSection = Array.from(itemsInDestSectionCurrent);
            const itemToInsertForCalc = { ...draggedQuestion, section: newSection, order_number: -1 }; // Placeholder
            tempDestSection.splice(destination.index, 0, itemToInsertForCalc);

            const destSectionIndex = APPLICATION_SECTION_ORDER.indexOf(destinationSectionName as typeof APPLICATION_SECTION_ORDER[number]);
            const destSectionBase = (destSectionIndex !== -1 ? destSectionIndex + 1 : APPLICATION_SECTION_ORDER.length + 1) * 10000;

            // Get the actual previous and next questions from the temporary list
            const prevQuestionInDest = tempDestSection[destination.index - 1];
            const nextQuestionInDest = tempDestSection[destination.index + 1]; 

            if (!prevQuestionInDest) { // Dropped at the beginning of the new section
                 if (nextQuestionInDest && nextQuestionInDest.id !== draggableId) { 
                    const firstItemOrderInDest = nextQuestionInDest.order_number || 0;
                    if (Math.floor(firstItemOrderInDest / 10000) * 10000 === destSectionBase) {
                         let newLocalOrder = (firstItemOrderInDest % 10000) / 2.0;
                         if (newLocalOrder < 1) newLocalOrder = (firstItemOrderInDest % 10000) * 0.5 || 50; 
                         if (destSectionBase + newLocalOrder >= firstItemOrderInDest) newLocalOrder = (firstItemOrderInDest % 10000) - 50; 
                         if (newLocalOrder < 0.01 && (firstItemOrderInDest % 10000) > 0) newLocalOrder = (firstItemOrderInDest % 10000) * 0.1; // try smaller fraction
                         if (newLocalOrder < 0.01) newLocalOrder = 0.01; // absolute fallback for very small/zero next order
                         newOrderNumber = destSectionBase + newLocalOrder;
                    } else { 
                        newOrderNumber = destSectionBase + 50; 
                    }
                 } else { 
                    newOrderNumber = destSectionBase + 50; 
                 }
            } else if (!nextQuestionInDest) { // Dropped at the end of the new section
                // Ensure prevQuestionInDest.order_number is within the destSectionBase before adding
                const prevOrder = prevQuestionInDest.id === draggableId ? destSectionBase : (prevQuestionInDest.order_number || destSectionBase);
                if (Math.floor(prevOrder / 10000) * 10000 !== destSectionBase) { // prev item not in this section (edge case)
                    newOrderNumber = destSectionBase + 100; 
                } else {
                    newOrderNumber = prevOrder + 100.0;
                }
            } else { // Dropped in the middle of the new section
                 // Ensure both prev and next are actually in the destination section for calculation
                 const prevOrder = (prevQuestionInDest.id === draggableId || Math.floor((prevQuestionInDest.order_number || 0) / 10000) * 10000 !== destSectionBase) ? destSectionBase : (prevQuestionInDest.order_number || destSectionBase);
                 const nextOrder = (nextQuestionInDest.id === draggableId || Math.floor((nextQuestionInDest.order_number || 0) / 10000) * 10000 !== destSectionBase) ? (destSectionBase + 10000 -1) : (nextQuestionInDest.order_number || (destSectionBase + 10000 -1)) ;
                 newOrderNumber = (prevOrder + nextOrder) / 2.0;
            }
            
            // Final sanity check: Ensure the order number is within the destination section's logical block and positive local part
            if (Math.floor(newOrderNumber / 10000) * 10000 !== destSectionBase || (newOrderNumber % 10000) <= 0) {
                console.warn("Cross-section order calculation out of bounds or yielded non-positive local. Re-evaluating.", { currentCalc: newOrderNumber, destSectionBase });
                if (prevQuestionInDest && prevQuestionInDest.id !== draggableId && Math.floor((prevQuestionInDest.order_number||0)/10000)*10000 === destSectionBase) {
                    newOrderNumber = (prevQuestionInDest.order_number||0) + 100;
                } else if (nextQuestionInDest && nextQuestionInDest.id !== draggableId && Math.floor((nextQuestionInDest.order_number||0)/10000)*10000 === destSectionBase) {
                    let localOrder = (nextQuestionInDest.order_number % 10000) / 2;
                    if (localOrder < 1) localOrder = 50;
                    newOrderNumber = destSectionBase + localOrder;
                } else { 
                    newOrderNumber = destSectionBase + 50; // Absolute fallback if dropped in empty or weird state
                }
                 console.warn("Corrected order number to:", newOrderNumber);
            }
        }

        if (!isFinite(newOrderNumber) || newOrderNumber <=0 ) { // also check for non-positive order numbers generally
            console.error("ApplicationQuestionsManager: Calculated newOrderNumber is not finite or non-positive.", { newOrderNumber });
            setError("Failed to calculate a valid order. Please refresh and try again.");
            loadQuestions(true);
            return;
        }

        console.log("ApplicationQuestionsManager: Calculated new order_number and section", {
            questionId: draggableId,
            newOrderNumber,
            newSection,
            oldSection: draggedQuestion.section
        });

        // Optimistic UI Update
        const updatedQuestions = questions.map(q =>
            q.id === draggableId ? { ...q, order_number: newOrderNumber, section: newSection } : q
        );
        setQuestions(updatedQuestions.sort((a, b) => (a.order_number || 0) - (b.order_number || 0)));

        // Persist to Supabase
        try {
            setLoading(true);
            const { error: updateError } = await supabase
                .from('application_questions_2')
                .update({ order_number: newOrderNumber, section: newSection, updated_at: new Date().toISOString() })
                .match({ id: draggableId });

            if (updateError) throw updateError;

            console.log("ApplicationQuestionsManager: Question order and section updated successfully in DB.");
        } catch (err: any) {
            console.error('ApplicationQuestionsManager: Error updating question order/section:', err);
            setError(err.message || 'Failed to update question order/section. Please try again.');
            await loadQuestions(); 
        } finally {
            setLoading(false);
        }

    }, [questions, groupedQuestions, supabase, APPLICATION_SECTION_ORDER]); 
    // --- END DND HANDLER ---

    // handleAddNew function
    const handleAddNew = (sectionName?: string) => {
        console.log("ApplicationQuestionsManager: Initiating add new question.", sectionName ? { forSection: sectionName } : '(overall)');
        if (sectionName) {
            setEditingQuestion({
                id: '', 
                order_number: 0, // This will be properly calculated in QuestionFormModal
                text: '',
                type: 'text', 
                options: [],
                required: null, // Initialize required to null
                section: sectionName as ApplicationQuestion['section'],
                created_at: '', 
                updated_at: '', 
                file_storage_bucket: undefined,
                visibility_rules: {}, // Initialize as empty object, will be stringified by modal or use null
            });
        } else {
            setEditingQuestion(null); 
        }
        setShowModal(true);
    };

    // handleEdit function
    const handleEdit = (question: ApplicationQuestion) => {
        console.log("ApplicationQuestionsManager: Initiating edit question", { id: question.id });
        setEditingQuestion(question);
        setShowModal(true);
    };

    // handleDeleteClick function
    const handleDeleteClick = (id: string) => {
        console.log("ApplicationQuestionsManager: Prompting delete confirmation for", { id });
        setShowDeleteConfirm(id);
    };

    // handleDeleteConfirm function
    const handleDeleteConfirm = async () => {
        if (!showDeleteConfirm) return;

        const idToDelete = showDeleteConfirm;
        console.log("ApplicationQuestionsManager: Confirming delete for", { id: idToDelete });
        setLoading(true); 
        setError(null);
        setShowDeleteConfirm(null); 

        try {
            const { error: deleteError } = await supabase
                .from('application_questions_2') // Updated table name
                .delete()
                .match({ id: idToDelete });

            if (deleteError) throw deleteError;

            console.log("ApplicationQuestionsManager: Question deleted successfully", { id: idToDelete });
            await loadQuestions(); 
        } catch (err: any) {
            console.error('ApplicationQuestionsManager: Error deleting question:', err);
            setError(err.message || 'Failed to delete question');
            setLoading(false); 
        } 
    };

    // handleModalClose function
    const handleModalClose = (refresh: boolean = false) => {
        console.log("ApplicationQuestionsManager: Closing modal.", { refresh });
        setShowModal(false);
        setEditingQuestion(null);
        if (refresh) {
            loadQuestions(); 
        }
    };

    // TODO: Section intro feature needs re-evaluation or removal as 'section_intro_markdown' is no longer part of ApplicationQuestion type/table.
    /*
    const handleEditIntro = (sectionName: string) => {
        const sectionQuestions = groupedQuestions.get(sectionName) || [];
        // Error: Property 'section_intro_markdown' does not exist on type 'ApplicationQuestion'.
        const existingIntro = sectionQuestions.length > 0 ? sectionQuestions[0].section_intro_markdown || '' : '';
        setCurrentIntroMarkdown(existingIntro);
        setEditingIntroSection(sectionName === editingIntroSection ? null : sectionName); // Toggle
    };

    const handleSaveIntro = async (sectionName: string) => {
        setLoading(true);
        setError(null);
        console.log(`Saving intro for section: ${sectionName}`);
        try {
            const { error: updateError } = await supabase
                .from('application_questions_2') // Updated table name
                .update({ section_intro_markdown: currentIntroMarkdown, updated_at: new Date().toISOString() })
                .eq('section', sectionName);

            if (updateError) throw updateError;
            console.log(`Intro for section ${sectionName} saved successfully.`);
            setEditingIntroSection(null); // Close editor
            await loadQuestions(); // Refresh data
        } catch (err: any) {
            console.error(`Error saving intro for section ${sectionName}:`, err);
            setError(err.message || `Failed to save intro for ${sectionName}`);
        } finally {
            setLoading(false);
        }
    };
    */

    // DeleteConfirmation component
    const DeleteConfirmation = ({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) => createPortal(
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={onCancel}
        >
            <div
                className="relative z-[101] bg-[var(--color-furface-modal,theme(colors.gray.800))] p-6 rounded-sm shadow-xl max-w-sm w-full border border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-500 mr-3 flex-shrink-0" />
                    <h2 className="text-lg font-mono text-[var(--color-text-primary)]">Confirm Deletion</h2>
                </div>
                <p className="text-[var(--color-text-secondary)] mb-6 font-mono">Are you sure you want to delete this question? This action cannot be undone.</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] font-mono transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-sm bg-red-600 text-white hover:bg-red-700 font-mono transition-colors">
                        Delete
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );

    // --- Start of the main return block --- 
    if (loading && questions.length === 0) {
        return (
            <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-primary)]"></div>
            </div>
        );
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="p-4 md:p-6 space-y-6 relative">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl font-display font-light text-[var(--color-text-primary)]">Manage Application Questions</h2>
                    <button
                        onClick={() => handleAddNew()}
                        className="flex items-center gap-2 px-4 py-2 rounded-sm bg-emerald-800 text-white hover:bg-emerald-700 transition-colors font-mono text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add New Question (Overall)
                    </button>
                </div>

                {error && (
                    <div className="p-4 mb-4 bg-[var(--color-bg-error)] text-[var(--color-text-error)] rounded-sm font-mono">
                        Error: {error}
                    </div>
                )}

                {sectionNames.map((sectionName) => {
                    const questionsInSection = groupedQuestions.get(sectionName) || [];
                    // const isEditingThisIntro = editingIntroSection === sectionName; // TODO: Part of commented out section intro feature
                    return (
                        <div key={sectionName} className="space-y-4 p-4 border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-surface)]">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-display text-[var(--color-text-primary)] capitalize">
                                    {sectionName} Section
                                </h3>
                                <div className="flex items-center gap-2"> {/* Button group */}
                                    {/* TODO: Section intro feature needs re-evaluation
                                    <button
                                        onClick={() => handleEditIntro(sectionName)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors border border-[var(--color-border)]"
                                    >
                                        <BookOpen className="w-3.5 h-3.5" />
                                        {isEditingThisIntro ? 'Hide Intro Editor' : 'Edit Section Intro'}
                                        {isEditingThisIntro ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                    */}
                                    <button
                                        onClick={() => handleAddNew(sectionName)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors border border-[var(--color-border)]"
                                        title={`Add a new question to the ${sectionName} section`}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Question
                                    </button>
                                </div>
                            </div>

                            {/* TODO: Section intro feature needs re-evaluation
                            {isEditingThisIntro && (
                                <div className="space-y-3 p-3 border border-[var(--color-border-accent)] rounded-md bg-[var(--color-bg-surface-raised)]">
                                    <label htmlFor={`intro-${sectionName}`} className="block text-sm font-medium text-[var(--color-text-secondary)] font-mono">
                                        Introductory Markdown for "{sectionName}" section:
                                    </label>
                                    <textarea
                                        id={`intro-${sectionName}`}
                                        value={currentIntroMarkdown}
                                        onChange={(e) => setCurrentIntroMarkdown(e.target.value)}
                                        rows={5}
                                        className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-sm"
                                        placeholder={`Enter Markdown for the introduction to the ${sectionName} section. This will appear before the questions.`}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => setEditingIntroSection(null)} 
                                            className="px-3 py-1.5 rounded-md text-xs bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={() => handleSaveIntro(sectionName)} 
                                            disabled={loading}
                                            className="px-3 py-1.5 rounded-md text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                        >
                                            {loading ? 'Saving...' : 'Save Intro'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            */}

                            {/* Placeholder for questions table for this section */}
                            <div className="overflow-x-auto bg-[var(--color-bg-surface)] rounded-sm border border-[var(--color-border)] relative mt-4">
                                <table className="min-w-full divide-y divide-[var(--color-border)]">
                                    <thead className="bg-[var(--color-bg-surface-raised)]">
                                        <tr>
                                            <th scope="col" className="px-2 py-3 w-12"></th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">Order</th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono w-2/5">Text</th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">Type</th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">Required</th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">Visibility Rules</th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">Actions</th>
                                        </tr>
                                    </thead>
                                    <Droppable droppableId={sectionName} type="QUESTION">
                                        {(provided, snapshot) => (
                                            <tbody 
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className={`bg-[var(--color-bg-surface)] divide-y divide-[var(--color-border)] ${snapshot.isDraggingOver ? 'bg-[var(--color-bg-surface-hover)]' : ''}`}
                                            >
                                                {questionsInSection.map((q, index) => {
                                                    let dependencyText = "None";
                                                    const rules = q.visibility_rules;

                                                    if (rules) { 
                                                        let rulesStringForDisplay: string;

                                                        if (typeof rules === 'string') {
                                                            rulesStringForDisplay = rules;
                                                        } else if (typeof rules === 'object' && rules !== null) {
                                                            rulesStringForDisplay = JSON.stringify(rules);
                                                        } else {
                                                            rulesStringForDisplay = String(rules); // Fallback
                                                        }
                                                        
                                                        if (rulesStringForDisplay && rulesStringForDisplay !== '{}') { 
                                                            dependencyText = `Rules: ${rulesStringForDisplay.substring(0,50)}${rulesStringForDisplay.length > 50 ? '...' : ''}`;
                                                        } else {
                                                            dependencyText = "None"; // If rules object is empty or string is empty JSON
                                                        }
                                                    }
                                                    /* OLD LOGIC FOR DELETED FIELDS:
                                                    if (q.depends_on_question_id) {
                                                        const parentQuestion = questions.find(pq => pq.id === q.depends_on_question_id);
                                                        const parentText = parentQuestion ? parentQuestion.text.substring(0, 30) + (parentQuestion.text.length > 30 ? '...' : '') : "Unknown Question";
                                                        dependencyText = `On "${parentText}" is "${q.depends_on_question_answer || 'Any'}"`;
                                                    }
                                                    */

                                                    return (
                                                        <Draggable key={q.id} draggableId={q.id} index={index}>
                                                            {(providedDraggable, snapshotDraggable) => (
                                                                <tr
                                                                    ref={providedDraggable.innerRef}
                                                                    {...providedDraggable.draggableProps}
                                                                    className={`hover:bg-[var(--color-bg-surface-hover)] transition-colors ${snapshotDraggable.isDragging ? 'shadow-lg bg-[var(--color-accent-primary-muted)]' : ''}`}
                                                                >
                                                                    <td 
                                                                        {...providedDraggable.dragHandleProps}
                                                                        className="px-2 py-3 whitespace-nowrap text-sm text-[var(--color-text-secondary)] font-mono cursor-grab"
                                                                        title="Drag to reorder"
                                                                    >
                                                                        <GripVertical className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--color-text-secondary)] font-mono">{q.order_number?.toFixed(3)}</td>
                                                                    <td className="px-4 py-3 text-sm text-[var(--color-text-primary)] font-mono max-w-md truncate" title={q.text}>{q.text}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--color-text-secondary)] font-mono">{q.type}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--color-text-secondary)] font-mono">{q.required ? 'Yes' : 'No'}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--color-text-secondary)] font-mono max-w-xs truncate" title={dependencyText}>{dependencyText}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                                                                        <button onClick={() => handleEdit(q)} title="Edit Question" className="text-[var(--color-text-secondary)] hover:text-blue-600 transition-colors p-1 rounded hover:bg-[var(--color-bg-surface-hover)]">
                                                                            <Edit className="w-4 h-4" />
                                                                        </button>
                                                                        <button onClick={() => handleDeleteClick(q.id)} title="Delete Question" className="text-[var(--color-text-secondary)] hover:text-red-600 transition-colors p-1 rounded hover:bg-[var(--color-bg-surface-hover)]">
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Draggable>
                                                    );
                                                })}
                                                {provided.placeholder}
                                                {!loading && questionsInSection.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-secondary)] font-mono">
                                                            No questions found in this section. Drag one here or add a new question.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        )}
                                    </Droppable>
                                </table>
                                {loading && questions.length > 0 && ( 
                                    <div className="absolute inset-0 bg-[var(--color-bg-surface)]/70 dark:bg-[var(--color-bg-surface-raised)]/50 flex justify-center items-center rounded-sm backdrop-blur-sm">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-accent-primary)]"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {showModal && (
                    <QuestionFormModal
                        question={editingQuestion}
                        allQuestions={questions} 
                        onClose={handleModalClose}
                    />
                )}

                {showDeleteConfirm && (
                    <DeleteConfirmation
                        onConfirm={handleDeleteConfirm}
                        onCancel={() => setShowDeleteConfirm(null)}
                    />
                )}
            </div>
        </DragDropContext>
    );
    // --- End of the main return block --- 
}

