import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, CheckCircle, XCircle, Clock, Trash2, Search, X as ClearSearchIcon } from 'lucide-react';
import { ApplicationDetails } from './ApplicationDetails';
import { motion, AnimatePresence } from 'framer-motion';
import { getFrontendUrl } from '../../lib/environment';
import { getAnswer } from '../../lib/old_question_mapping';
import type { QuestionForAnswerRetrieval } from '../../lib/old_question_mapping';
import { usePagination, DOTS } from '../../hooks/usePagination';

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

const ITEMS_PER_PAGE = 15;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalApplicationsCount, setTotalApplicationsCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
      new Promise(resolve => {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(() => resolve(func(...args)), waitFor);
      });
  };

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
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
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      if (activeSearchQuery) {
        query = query.ilike('user_email', `%${activeSearchQuery}%`);
      }

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      console.log('Applications2: Raw data fetched:', data, 'Total count:', count);

      const processedApplications = (data || []).map(app => {
        const seenWelcome = !!app.raw_user_meta_data?.has_seen_welcome;
        return {
          ...app,
          seen_welcome: seenWelcome,
        };
      });

      console.log('Applications2: Processed applications with user data:', processedApplications);
      setApplications(processedApplications);
      setTotalApplicationsCount(count || 0);

    } catch (err) {
      console.error('Error loading applications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load applications');
      setApplications([]);
      setTotalApplicationsCount(0);
    } finally {
      setLoading(false);
    }
  }, [filter, currentPage, activeSearchQuery, supabase]);

  const debouncedLoadApplications = useCallback(debounce(loadApplications, 500), [loadApplications]);

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadApplications();
  }, [loadApplications]);

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
      if (applications.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        await loadApplications();
      }
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

  const handleFilterChange = (newFilter: 'all' | 'pending' | 'approved' | 'rejected') => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearch = () => {
    setActiveSearchQuery(searchTerm.trim());
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveSearchQuery('');
    setCurrentPage(1);
  };

  const paginationRange = usePagination({
    currentPage,
    totalCount: totalApplicationsCount,
    siblingCount: 1,
    pageSize: ITEMS_PER_PAGE
  });

  const totalPageCount = Math.ceil(totalApplicationsCount / ITEMS_PER_PAGE);

  if (loading && applications.length === 0) {
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

      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div className="flex gap-4">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors text-sm whitespace-nowrap ${
              filter === 'all'
                ? 'bg-emerald-900 text-white font-mono'
                : 'bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] border border-[var(--color-border)] font-mono'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('pending')}
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
            onClick={() => handleFilterChange('approved')}
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
            onClick={() => handleFilterChange('rejected')}
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

        <div className="flex gap-2 items-center flex-grow sm:flex-grow-0">
          <input 
            type="text"
            placeholder="Search by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleSearch(); }}
            className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-sm flex-grow"
          />
          <button
            onClick={handleSearch}
            className="p-2 rounded-lg bg-[var(--color-button-secondary-bg)] text-[var(--color-text-primary)] hover:bg-[var(--color-button-secondary-bg-hover)] border border-[var(--color-border)]"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
          {activeSearchQuery && (
            <button
              onClick={handleClearSearch}
              className="p-2 rounded-lg bg-[var(--color-button-secondary-bg)] text-[var(--color-text-error)] hover:bg-[var(--color-error-bg-hover)] border border-[var(--color-border)]"
              title="Clear Search"
            >
              <ClearSearchIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-primary)]"></div>
        </div>
      )}

      <div className="space-y-4 relative">
        <AnimatePresence>
          {applications.map((application) => (
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
        {(!loading && applications.length === 0) && (
          <div className="text-center py-10 text-[var(--color-text-secondary)] font-mono">
            No applications found for the current filter.
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
        <div className="font-mono text-sm text-[var(--color-text-secondary)] order-2 sm:order-1">
          Page {currentPage} of {totalPageCount > 0 ? totalPageCount : 1}
          {totalApplicationsCount > 0 && !activeSearchQuery &&
            ` (Showing ${((currentPage - 1) * ITEMS_PER_PAGE) + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, totalApplicationsCount)} of ${totalApplicationsCount})`
          }
          {totalApplicationsCount > 0 && activeSearchQuery &&
            ` (Found ${totalApplicationsCount} matching "${activeSearchQuery}")`
          }
          {totalApplicationsCount === 0 && activeSearchQuery && ` (No matches for "${activeSearchQuery}")`}
          {totalApplicationsCount === 0 && !activeSearchQuery && ` (No applications)`}
        </div>

        {totalPageCount > 0 && (
          <div className="flex items-center space-x-1 order-1 sm:order-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              Prev
            </button>
            {paginationRange?.map((pageNumber, index) => {
              if (pageNumber === DOTS) {
                return <span key={`${pageNumber}-${index}`} className="px-3 py-1.5 text-[var(--color-text-secondary)] font-mono text-xs">...</span>;
              }

              const pageNum = pageNumber as number;
              return (
                <button
                  key={`${pageNumber}-${index}`}
                  onClick={() => setCurrentPage(pageNum)}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    currentPage === pageNum
                      ? 'bg-emerald-900 text-white'
                      : 'bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)]'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPageCount, prev + 1))}
              disabled={currentPage === totalPageCount || loading || totalPageCount === 0}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPageCount)}
              disabled={currentPage === totalPageCount || loading || totalPageCount === 0}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              Last
            </button>
          </div>
        )}
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
