import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { ApplicationDetails } from './ApplicationDetails';
import { motion, AnimatePresence } from 'framer-motion';
import { getFrontendUrl } from '../../lib/environment';
import { getAnswer } from '../../lib/old_question_mapping';
import type { QuestionForAnswerRetrieval } from '../../lib/old_question_mapping';

interface Application {
  id: string;
  user_id: string;
  data: any;
  status: string;
  created_at: string;
  user_email: string;
  linked_name?: string;
  linked_email?: string;
  linked_application_id?: string;
  linked_user_email?: string;
  last_sign_in_at?: string | null;
  seen_welcome?: boolean;
}

export function Applications2() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null);

  useEffect(() => {
    loadApplications();
    loadQuestions();
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('application_details')
        .select(`
          id,
          user_id,
          data,
          status,
          created_at,
          user_email,
          linked_name,
          linked_email,
          linked_application_id,
          last_sign_in_at,
          raw_user_meta_data
        `)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      console.log('Applications2: Raw data fetched:', data);

      const processedApplications = (data || []).map(app => {
        const seenWelcome = !!app.raw_user_meta_data?.has_seen_welcome;
        return {
          ...app,
          seen_welcome: seenWelcome,
        };
      });

      console.log('Applications2: Processed applications with user data:', processedApplications);
      setApplications(processedApplications);

    } catch (err) {
      console.error('Error loading applications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load applications');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      const { data, error: queryError } = await supabase
        .from('application_questions_2')
        .select('*')
        .order('order_number');

      if (queryError) throw queryError;
      setQuestions(data || []);
    } catch (err) {
      console.error('Error loading questions:', err);
    }
  };

  const updateApplicationStatus = async (id: string, status: string) => {
    try {
      setLoadingStates(prev => ({ ...prev, [id]: true }));

      if (status === 'approved') {
        const application = applications.find(app => app.id === id);
        console.log('Applications2: Approving application', { id, email: application?.user_email });
        const { error } = await supabase.rpc('approve_application', {
          p_application_id: id
        });
        console.log('Applications2: Approval result', { error });
        
        if (!error && application?.user_email) {
          const { error: emailError } = await supabase.functions.invoke('send-approval-email', {
            body: { 
              email: application.user_email,
              applicationId: id,
              frontendUrl: getFrontendUrl()
            }
          });
          console.log('Applications2: Email sending result', { emailError });
        }
      } else if (status === 'rejected') {
        const application = applications.find(app => app.id === id);
        console.log('Applications2: Rejecting application', { id, email: application?.user_email });
        console.log('type of id', typeof id);
        console.log('Is valid UUID?', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
        const { error } = await supabase.rpc('reject_application', {
          p_application_id: id
        });
        
        if (!error && application?.user_email) {
          const { error: emailError } = await supabase.functions.invoke('send-rejection-email', {
            body: { 
              email: application.user_email,
              applicationId: id
            }
          });
          console.log('Applications2: Email sending result', { emailError });
        }
        
        if (error) throw error;
      }
      await loadApplications();
    } catch (err) {
      console.error('Error updating application:', err);
      setError(err instanceof Error ? err.message : 'Failed to update application');
    } finally {
      setLoadingStates(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDeleteApplication = async () => {
    if (!applicationToDelete) return;

    const { id } = applicationToDelete;
    try {
      setLoadingStates(prev => ({ ...prev, [id]: true }));
      setError(null);

      const { error: rpcError } = await supabase.rpc('delete_application', {
        p_application_id: id
      });

      if (rpcError) throw rpcError;

      console.log('Applications2: Application deleted successfully', { id });
      setApplications(prev => prev.filter(app => app.id !== id));
      setShowDeleteConfirmModal(false);
      setApplicationToDelete(null);

    } catch (err) {
      console.error('Error deleting application:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete application');
    } finally {
      setLoadingStates(prev => ({ ...prev, [id]: false }));
    }
  };

  const openDeleteConfirmModal = (application: Application) => {
    setApplicationToDelete(application);
    setShowDeleteConfirmModal(true);
  };

  const closeDeleteConfirmModal = () => {
    setApplicationToDelete(null);
    setShowDeleteConfirmModal(false);
  };

  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-6 p-4 bg-[var(--color-bg-error)] text-[var(--color-text-error)] rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
            filter === 'all'
              ? 'bg-emerald-900 text-white font-mono'
              : 'bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] border border-[var(--color-border)] font-mono'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
            filter === 'pending'
              ? 'bg-emerald-900 text-white font-mono'
              : 'bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] border border-[var(--color-border)] font-mono'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
            filter === 'approved'
              ? 'bg-emerald-900 text-white font-mono'
              : 'bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] border border-[var(--color-border)] font-mono'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          Approved
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
            filter === 'rejected'
              ? 'bg-emerald-900 text-white font-mono'
              : 'bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] border border-[var(--color-border)] font-mono'
          }`}
        >
          <XCircle className="w-4 h-4" />
          Rejected
        </button>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {filteredApplications.map((application) => (
            <motion.div
              key={application.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[var(--color-bg-surface)] p-6 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <button
                    onClick={() => setSelectedApplication(application)}
                    className="font-medium font-mono text-2xl text-[var(--color-text-primary)] hover:text-[var(--color-accent-primary)] transition-colors text-left group"
                  >
                    <span className="group-hover:underline">
                      {(() => {
                        if (questions.length > 0 && application.data) {
                          // Find questions by text, as short_code might not be on application_questions_2
                          const firstNameQuestion = questions.find(q => q.text === "First Name") as QuestionForAnswerRetrieval | undefined;
                          const lastNameQuestion = questions.find(q => q.text === "Last Name") as QuestionForAnswerRetrieval | undefined;

                          let firstName = '';
                          let lastName = '';

                          if (firstNameQuestion) {
                            firstName = getAnswer(application.data, firstNameQuestion) || '';
                          }
                          if (lastNameQuestion) {
                            lastName = getAnswer(application.data, lastNameQuestion) || '';
                          }
                          
                          if (!firstNameQuestion) console.warn(`Applications2: Could not find 'First Name' question definition for app ${application.id}`);
                          if (!lastNameQuestion) console.warn(`Applications2: Could not find 'Last Name' question definition for app ${application.id}`);

                          return `${firstName} ${lastName}`.trim() || "Applicant Name Missing";
                        }
                        return "Applicant Name Unavailable";
                      })()}
                    </span>
                  </button>
                  <p className="text-sm text-[var(--color-text-secondary)] font-mono">
                    {application.user_email}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] font-mono mt-1">
                    Submitted: {new Date(application.created_at).toISOString().slice(0, 10)}
                  </p>
                  {application.last_sign_in_at && (
                    <p className="text-xs text-[var(--color-text-tertiary)] font-mono mt-1">
                      Last sign in: {new Date(application.last_sign_in_at).toISOString().slice(0, 10)}
                    </p>
                  )}
                  {application.seen_welcome && (
                    <p className="text-xs text-emerald-600 font-mono mt-1">
                      Welcome Seen
                    </p>
                  )}
                  {application.linked_name && (
                    <div className="mt-2 text-sm text-[var(--color-text-secondary)] font-mono">
                      Linked with: {application.linked_name} ({application.linked_email})
                      {application.linked_application_id && (
                        <span className="ml-2 text-emerald-600">• Applied</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedApplication(application)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-button-secondary-bg)] text-[var(--color-text-primary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors font-mono text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>

                  {application.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateApplicationStatus(application.id, 'approved')}
                        disabled={loadingStates[application.id]}
                        className={`p-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors ${
                          loadingStates[application.id] ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateApplicationStatus(application.id, 'rejected')}
                        disabled={loadingStates[application.id]}
                        className={`p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors ${
                          loadingStates[application.id] ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => openDeleteConfirmModal(application)}
                    disabled={loadingStates[application.id]}
                    className={`p-2 rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-colors ${
                      loadingStates[application.id] ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Delete Application"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <span className={`px-3 py-1 rounded-full text-xs font-medium font-mono ${
                    application.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : application.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {application.status}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {selectedApplication && (
        <ApplicationDetails
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          questions={questions}
        />
      )}

      {showDeleteConfirmModal && applicationToDelete && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          onClick={closeDeleteConfirmModal}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-[var(--color-bg-surface)] p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-md border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4 font-mono">Confirm Deletion</h2>
            <p className="text-[var(--color-text-secondary)] mb-6 font-mono">
              Are you sure you want to permanently delete the application for <strong className="text-[var(--color-text-primary)]">{applicationToDelete.user_email}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeDeleteConfirmModal}
                className="px-4 py-2 rounded-lg bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteApplication}
                disabled={loadingStates[applicationToDelete.id]}
                className={`px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-mono flex items-center justify-center ${
                  loadingStates[applicationToDelete.id] ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loadingStates[applicationToDelete.id] ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
