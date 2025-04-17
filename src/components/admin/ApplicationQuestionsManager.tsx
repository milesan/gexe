import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
// Import the actual modal component
import { QuestionFormModal } from './QuestionFormModal';

// Define the structure of a question based on your description
interface ApplicationQuestion {
    id: string;
    order_number: number;
    text: string;
    type: 'text' | 'textarea' | 'radio' | 'file' | 'tel';
    options?: string[];
    required: boolean;
    section: 'intro' | 'personal' | 'stay' | 'philosophy';
    created_at: string;
    updated_at: string;
    file_storage_bucket?: string;
}

export function ApplicationQuestionsManager() {
    // State hooks 
    const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<ApplicationQuestion | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // useEffect hook
    useEffect(() => {
        loadQuestions();
    }, []);

    // loadQuestions function
    const loadQuestions = async () => {
        console.log("ApplicationQuestionsManager: Fetching questions...");
        setLoading(true); 
        setError(null);
        try {
            const { data, error: queryError } = await supabase
                .from('application_questions')
                .select('*')
                .order('order_number', { ascending: true });

            if (queryError) throw queryError;
            
            setQuestions(data || []);
            console.log("ApplicationQuestionsManager: Questions fetched successfully", data?.length);
        } catch (err: any) {
            console.error('ApplicationQuestionsManager: Error loading questions:', err);
            setError(err.message || 'Failed to load questions');
        } finally {
            setLoading(false);
        }
    };

    // handleAddNew function
    const handleAddNew = () => {
        console.log("ApplicationQuestionsManager: Initiating add new question.");
        setEditingQuestion(null); 
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
                .from('application_questions')
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

    // DeleteConfirmation component
    const DeleteConfirmation = ({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) => createPortal(
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={onCancel}
        >
            <div
                className="relative z-[101] bg-[var(--color-furface-modal,theme(colors.gray.800))] p-6 rounded-lg shadow-xl max-w-sm w-full border border-[var(--color-border)]"
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
                        className="px-4 py-2 rounded-lg bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] font-mono transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-mono transition-colors">
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
        <div className="p-4 md:p-6 space-y-6 relative">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-light text-[var(--color-text-primary)]">Manage Application Questions</h2>
                <button
                    onClick={handleAddNew}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-mono text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add New Question
                </button>
            </div>

            {error && (
                <div className="p-4 bg-[var(--color-bg-error)] text-[var(--color-text-error)] rounded-lg font-mono">
                    Error: {error}
                </div>
            )}

            <div className="overflow-x-auto bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border)] relative">
                <table className="min-w-full divide-y divide-[var(--color-border)]">
                    <thead className="bg-[var(--color-bg-surface-raised)]">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">Order</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono w-2/5">Text</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">Type</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">Section</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">Required</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-[var(--color-bg-surface)] divide-y divide-[var(--color-border)]">
                        {questions.map((q) => (
                            <tr key={q.id} className="hover:bg-[var(--color-bg-surface-hover)] transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--color-text-secondary)] font-mono">{q.order_number}</td>
                                <td className="px-4 py-3 text-sm text-[var(--color-text-primary)] font-mono max-w-md">{q.text}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--color-text-secondary)] font-mono">{q.type}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--color-text-secondary)] font-mono">{q.section}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--color-text-secondary)] font-mono">{q.required ? 'Yes' : 'No'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                                    <button onClick={() => handleEdit(q)} title="Edit Question" className="text-[var(--color-text-secondary)] hover:text-blue-600 transition-colors p-1 rounded hover:bg-[var(--color-bg-surface-hover)]">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteClick(q.id)} title="Delete Question" className="text-[var(--color-text-secondary)] hover:text-red-600 transition-colors p-1 rounded hover:bg-[var(--color-bg-surface-hover)]">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!loading && questions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-text-secondary)] font-mono">
                                    No questions found. Add one using the button above!
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {loading && questions.length > 0 && ( 
                    <div className="absolute inset-0 bg-[var(--color-bg-surface)]/70 dark:bg-[var(--color-bg-surface-raised)]/50 flex justify-center items-center rounded-lg backdrop-blur-sm">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-accent-primary)]"></div>
                    </div>
                )}
            </div>

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
    );
    // --- End of the main return block --- 
}

