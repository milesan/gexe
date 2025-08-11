import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, CheckCircle, XCircle, Clock, Trash2, Search, X as ClearSearchIcon, ThumbsUp, ThumbsDown, Euro } from 'lucide-react';
import { ApplicationDetails } from './ApplicationDetails';
import { motion, AnimatePresence } from 'framer-motion';
import { getFrontendUrl } from '../../lib/environment';
import { getAnswer } from '../../lib/old_question_mapping';
import type { QuestionForAnswerRetrieval } from '../../lib/old_question_mapping';
import { usePagination, DOTS } from '../../hooks/usePagination';
import { useSession } from '../../hooks/useSession';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ManageCreditsModal } from './ManageCreditsModal';
import { useCredits } from '../../hooks/useCredits';

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
  is_whitelisted?: boolean;
  admin_verdicts?: Record<string, string>;
  credits?: number;
  final_action?: {
    admin: string;
    action: string;
    timestamp: string;
  };
}

const ITEMS_PER_PAGE = 15;

// Add new type for action type
type ActionType = 'approve' | 'reject';

// Helper function to get admin name from email
const getAdminName = (email: string): string => {
  const names: Record<string, string> = {
    'dawn@thegarden.pt': 'Dawn',
    'andre@thegarden.pt': 'Andre',
    'simone@thegarden.pt': 'Simone',
    'redis213@gmail.com': 'Richard'
  };
  return names[email] || email.split('@')[0];
};

export function Applications2() {
  const { session } = useSession();
  const { isAdmin } = useUserPermissions(session);
  const { refresh: refreshGlobalCredits } = useCredits();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [themedResidencyFilter, setThemedResidencyFilter] = useState<string>('none');
  const [availableThemedResidencies, setAvailableThemedResidencies] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null);
  const [deleteConfirmationEmailInput, setDeleteConfirmationEmailInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalApplicationsCount, setTotalApplicationsCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_at_desc');
  // Add new state variables for action confirmation
  const [showActionConfirmModal, setShowActionConfirmModal] = useState(false);
  const [applicationToAction, setApplicationToAction] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [showManageCreditsModal, setShowManageCreditsModal] = useState(false);
  const [selectedApplicationForCredits, setSelectedApplicationForCredits] = useState<Application | null>(null);

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

  const fetchWhitelistStatus = async (emails: string[]) => {
    try {
      const { data, error } = await supabase
        .from('whitelist')
        .select('email')
        .in('email', emails);
      
      if (error) throw error;
      
      const whitelistedEmails = new Set(data?.map(w => w.email) || []);
      return whitelistedEmails;
    } catch (err) {
      console.error('Error fetching whitelist status:', err);
      return new Set<string>();
    }
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
          raw_user_meta_data,
          admin_verdicts,
          credits,
          final_action
        `, { count: 'exact' });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      if (activeSearchQuery) {
        // Search by email OR name
        const firstNameQuestion = questions.find(q => q.id === "39f455d1-0de8-438f-8f34-10818eaec15e");
        const lastNameQuestion = questions.find(q => q.id === "246d0acf-25cd-4e4e-9434-765e6ea679cb");
        
        if (firstNameQuestion && lastNameQuestion) {
          // Search by email OR first name OR last name OR full name
          query = query.or(`user_email.ilike.%${activeSearchQuery}%,data->>${firstNameQuestion.id}.ilike.%${activeSearchQuery}%,data->>${lastNameQuestion.id}.ilike.%${activeSearchQuery}%`);
        } else {
          // Fallback to email-only search if questions not found
          query = query.ilike('user_email', `%${activeSearchQuery}%`);
        }
      }
      
      // Apply themed residency filter
      if (themedResidencyFilter !== 'none') {
        const themedResidencyQuestionId = "bfde0ed9-319a-45e4-8b0d-5c694ca2c850";
        if (themedResidencyFilter === 'all') {
          // Filter for all applications with any themed residency (not "No<3" or "No <3")
          query = query.not('data->>' + themedResidencyQuestionId, 'eq', 'No<3')
                       .not('data->>' + themedResidencyQuestionId, 'eq', 'No <3');
        } else {
          // Filter for specific themed residency
          query = query.like('data->>' + themedResidencyQuestionId, `${themedResidencyFilter}%`);
        }
      }
      
      if (sortBy === 'arrival_date_asc') {
        // NOTE: This relies on finding the question for the arrival date.
        // The question text might need adjustment if it's different in the database.
        const arrivalDateQuestion = questions.find(q => q.id === "ae5cc5b2-e2ec-4126-9e53-7ab7fc495324");
        if (arrivalDateQuestion) {
            query = query.order(`data->>${arrivalDateQuestion.id}`, { ascending: true, nullsFirst: false });
        } else {
            console.warn("Applications2: Could not find 'Desired Arrival Date' question. Defaulting to sort by submission date.");
            query = query.order('created_at', { ascending: false });
        }
      } else { // 'created_at_desc'
          query = query.order('created_at', { ascending: false });
      }

      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      console.log('Applications2: Raw data fetched:', data, 'Total count:', count);

      const processedApplications = (data || []).map(app => {
        const seenWelcome = !!app.raw_user_meta_data?.has_seen_welcome;
        console.log('Applications2: Processing app', {
          id: app.id,
          email: app.user_email,
          admin_verdicts: app.admin_verdicts
        });
        return {
          ...app,
          seen_welcome: seenWelcome,
        };
      });

      // Fetch whitelist status for all applications in this page
      const emails = processedApplications.map(app => app.user_email);
      const whitelistedEmails = await fetchWhitelistStatus(emails);

      // Add whitelist status to applications
      const applicationsWithWhitelist = processedApplications.map(app => ({
        ...app,
        is_whitelisted: whitelistedEmails.has(app.user_email)
      }));

      console.log('Applications2: Processed applications with user data:', applicationsWithWhitelist);
      setApplications(applicationsWithWhitelist);
      setTotalApplicationsCount(count || 0);

    } catch (err) {
      console.error('Error loading applications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load applications');
      setApplications([]);
      setTotalApplicationsCount(0);
    } finally {
      setLoading(false);
    }
  }, [filter, currentPage, activeSearchQuery, supabase, sortBy, questions, themedResidencyFilter]);

  const debouncedLoadApplications = useCallback(debounce(loadApplications, 500), [loadApplications]);

  // Fetch available themed residencies
  const fetchAvailableThemedResidencies = async () => {
    try {
      const { data, error } = await supabase
        .from('application_details')
        .select('data')
        .not('data->>bfde0ed9-319a-45e4-8b0d-5c694ca2c850', 'eq', 'No<3')
        .not('data->>bfde0ed9-319a-45e4-8b0d-5c694ca2c850', 'eq', 'No <3');
      
      if (error) throw error;
      
      const uniquePrograms = new Set<string>();
      (data || []).forEach(app => {
        const answer = app.data?.['bfde0ed9-319a-45e4-8b0d-5c694ca2c850'];
        if (answer && answer !== 'No<3' && answer !== 'No <3') {
          const programName = answer.split(' | ')[0] || answer;
          uniquePrograms.add(programName);
        }
      });
      
      setAvailableThemedResidencies(Array.from(uniquePrograms).sort());
    } catch (err) {
      console.error('Error fetching themed residencies:', err);
    }
  };

  useEffect(() => {
    loadQuestions();
    fetchAvailableThemedResidencies();
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

  const updateAdminVerdict = async (applicationId: string, clickedVerdict: 'thumbs_up' | 'thumbs_down') => {
    const adminEmail = session?.user?.email;
    if (!adminEmail) {
      setError("User session not found. Cannot update verdict.");
      console.error("Applications2: Admin email not found in session for verdict update.");
      return;
    }

    const application = applications.find(app => app.id === applicationId);
    if (!application) {
      setError("Application not found. Cannot update verdict.");
      console.error("Applications2: Application not found for verdict update:", applicationId);
      return;
    }

    const currentAdminSavedVerdict = application.admin_verdicts?.[adminEmail];
    let newVerdictForRPC: 'thumbs_up' | 'thumbs_down' | 'remove' = clickedVerdict;

    if (currentAdminSavedVerdict === clickedVerdict) {
      newVerdictForRPC = 'remove'; // This signals to the RPC to remove the verdict
    }

    try {
      setLoadingStates(prev => ({ ...prev, [`${applicationId}_verdict`]: true }));

      console.log('Applications2: Before RPC call', {
        applicationId,
        adminEmail,
        currentVerdict: currentAdminSavedVerdict,
        clickedVerdict,
        newVerdictForRPC,
        currentAdminVerdicts: application.admin_verdicts
      });

      // The RPC 'update_admin_verdict' needs to handle p_verdict = 'remove'
      // as an instruction to remove the admin's verdict for this application.
      const { error } = await supabase.rpc('update_admin_verdict', {
        p_application_id: applicationId,
        p_verdict: newVerdictForRPC // This can now be 'thumbs_up', 'thumbs_down', or 'remove'
      });

      if (error) {
        console.error('Applications2: Error updating admin verdict via RPC:', error);
        // It might be useful to provide more specific error messages if the RPC returns structured errors
        throw new Error(`Failed to update verdict: ${error.message}`);
      }

      console.log('Applications2: RPC call successful, reloading applications...');

      // Reload applications to reflect the change.
      // loadApplications() will fetch the fresh state including updated admin_verdicts.
      await loadApplications();
      
      console.log('Applications2: Applications reloaded');
    } catch (err) {
      console.error('Applications2: Error in updateAdminVerdict function:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while updating verdict.');
      // Optionally, revert optimistic UI updates here if any were made, though loadApplications() should correct it.
    } finally {
      setLoadingStates(prev => ({ ...prev, [`${applicationId}_verdict`]: false }));
    }
  };

  const handleConfirmDeleteUserAndApplication = async () => {
    if (!applicationToDelete || deleteConfirmationEmailInput !== applicationToDelete.user_email) return;

    const { id: applicationId, user_id: userId, user_email: userEmail } = applicationToDelete;
    try {
      setLoadingStates(prev => ({ ...prev, [applicationId]: true }));
      setError(null);

      console.log(`Applications2: Attempting to delete auth user ${userId} (${userEmail})`);
      // Step 1: Delete the auth user via Edge Function
      const { error: authUserDeleteError } = await supabase.functions.invoke('delete-auth-user', {
        body: { userId: userId }
      });

      if (authUserDeleteError) {
        console.error('Error deleting auth user:', authUserDeleteError);
        throw new Error(`Failed to delete user account: ${authUserDeleteError.message}`);
      }
      console.log(`Applications2: Auth user ${userId} deleted successfully.`);

      // Step 2: Delete the application record via RPC (REMOVED - Handled by DB cascade)
      // console.log(`Applications2: Attempting to delete application record ${applicationId}`);
      // const { error: rpcError } = await supabase.rpc('delete_application', {
      //   p_application_id: applicationId
      // });

      // if (rpcError) {
      //   console.error('Error deleting application record:', rpcError);
      //   throw new Error(`User account ${userEmail} deleted, but failed to delete application record: ${rpcError.message}`);
      // }

      console.log('Applications2: Application record should be cascade deleted.', { applicationId });
      
      // Refresh data or remove item from list
      if (applications.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1); // This will trigger a reload via useEffect
      } else {
        await loadApplications(); // Explicitly reload if not changing page
      }
      
      setShowDeleteConfirmModal(false);
      setApplicationToDelete(null);
      setDeleteConfirmationEmailInput('');

    } catch (err) {
      console.error('Error in delete user/application process:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during user deletion.');
      // Keep modal open on error so user sees the message, or decide on other UX
    } finally {
      setLoadingStates(prev => ({ ...prev, [applicationId]: false }));
    }
  };

  const openDeleteConfirmModal = (application: Application) => {
    setApplicationToDelete(application);
    setDeleteConfirmationEmailInput('');
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

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  const paginationRange = usePagination({
    currentPage,
    totalCount: totalApplicationsCount,
    siblingCount: 1,
    pageSize: ITEMS_PER_PAGE
  });

  const totalPageCount = Math.ceil(totalApplicationsCount / ITEMS_PER_PAGE);

  const initiateApplicationAction = (application: Application, action: ActionType) => {
    setApplicationToAction(application);
    setActionType(action);
    setShowActionConfirmModal(true);
  };

  const handleConfirmAction = async () => {
    if (!applicationToAction || !actionType) return;
    
    await updateApplicationStatus(applicationToAction.id, actionType === 'approve' ? 'approved' : 'rejected');
    setShowActionConfirmModal(false);
    setApplicationToAction(null);
    setActionType(null);
  };

  const closeActionConfirmModal = () => {
    setShowActionConfirmModal(false);
    setApplicationToAction(null);
    setActionType(null);
  };

  const handleManageCredits = (application: Application) => {
    setSelectedApplicationForCredits(application);
    setShowManageCreditsModal(true);
  };

  const handleCreditsUpdated = async (userId: string, newBalance: number) => {
    // Update the application in the local state
    setApplications(prev => prev.map(app => 
      app.user_id === userId 
        ? { ...app, credits: newBalance }
        : app
    ));
    
    // If the updated user is the current user, refresh global credits state
    const currentUserId = session?.user?.id;
    if (currentUserId === userId) {
      console.log('[Applications2] Admin updated own credits, refreshing global state');
      await refreshGlobalCredits();
    }
  };

  if (loading && applications.length === 0) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      {error && (
        <div className="mb-6 p-4 bg-[var(--color-bg-error)] text-[var(--color-text-error)] rounded-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6 items-start sm:items-center">
        <div className="flex flex-wrap gap-2 min-w-0">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs whitespace-nowrap font-mono ${
              filter === 'all'
                ? 'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/50'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('pending')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors text-xs font-mono ${
              filter === 'pending'
                ? 'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/50'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <Clock className="w-3 h-3" />
            Pending
          </button>
          <button
            onClick={() => handleFilterChange('approved')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors text-xs font-mono ${
              filter === 'approved'
                ? 'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/50'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <CheckCircle className="w-3 h-3" />
            Approved
          </button>
          <button
            onClick={() => handleFilterChange('rejected')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors text-xs font-mono ${
              filter === 'rejected'
                ? 'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/50'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            <XCircle className="w-3 h-3" />
            Rejected
          </button>
        </div>

        {/* Themed Residency Filter Dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <label htmlFor="themed-residency-filter" className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-nowrap">🌟 Program:</label>
          <select
            id="themed-residency-filter"
            value={themedResidencyFilter}
            onChange={(e) => {
              setThemedResidencyFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1 rounded-md text-xs border border-[var(--color-border)] font-mono bg-gray-800 text-gray-200 focus:outline-none hover:bg-gray-700 cursor-pointer"
          >
            <option value="none">All Applications</option>
            <option value="all">All Themed Residencies</option>
            {availableThemedResidencies.map(program => (
              <option key={program} value={program}>{program}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
            <label htmlFor="sort-order" className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-nowrap">Sort by:</label>
            <select
                id="sort-order"
                value={sortBy}
                onChange={handleSortChange}
                className="px-2.5 py-1 rounded-md text-xs border border-[var(--color-border)] font-mono bg-gray-800 text-gray-200 focus:outline-none hover:bg-gray-700 cursor-pointer"
            >
                <option value="created_at_desc">Submission Date (Newest)</option>
                <option value="arrival_date_asc">Arrival Date (Soonest)</option>
            </select>
        </div>

        <div className="flex gap-1.5 items-center flex-grow sm:flex-grow-0 min-w-0">
          <input 
            type="text"
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleSearch(); }}
            className="px-2.5 py-1 border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-xs flex-grow min-w-0"
          />
          <button
            onClick={handleSearch}
            className="p-1.5 rounded-md bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)] flex-shrink-0"
            title="Search"
          >
            <Search className="w-3 h-3" />
          </button>
          {activeSearchQuery && (
            <button
              onClick={handleClearSearch}
              className="p-1.5 rounded-md bg-[var(--color-bg-surface)] text-[var(--color-text-error)] hover:bg-[var(--color-error-bg-hover)] border border-[var(--color-border)] flex-shrink-0"
              title="Clear Search"
            >
              <ClearSearchIcon className="w-3 h-3" />
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
              className="bg-[var(--color-bg-surface)] p-6 rounded-sm border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors group"
            >
              {/* HEADER: Name, Email, Status */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <div 
                  className="cursor-pointer flex-1 min-w-0"
                  onClick={() => setSelectedApplication(application)}
                >
                  <h3 className="font-medium font-mono text-lg sm:text-xl text-[var(--color-text-primary)] hover:text-[var(--color-accent-primary)] transition-colors hover:underline break-words">
                    {(() => {
                      if (questions.length > 0 && application.data) {
                        const firstNameQuestion = questions.find(q => q.text === "First Name") as QuestionForAnswerRetrieval | undefined;
                        const lastNameQuestion = questions.find(q => q.text === "Last Name") as QuestionForAnswerRetrieval | undefined;
                        let firstName = firstNameQuestion ? getAnswer(application.data, firstNameQuestion) || '' : '';
                        let lastName = lastNameQuestion ? getAnswer(application.data, lastNameQuestion) || '' : '';
                        return `${firstName} ${lastName}`.trim() || "Applicant Name Missing";
                      }
                      return "Applicant Name Unavailable";
                    })()}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] font-mono mt-1 break-all">
                    {application.user_email}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:ml-4 flex-shrink-0">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-medium font-mono whitespace-nowrap ${
                      application.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : application.status === 'approved'
                        ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/50'
                        : 'bg-red-900/30 text-red-400 border border-red-700/50'
                    }`}>
                    {application.status.toUpperCase()}
                  </span>
                  {application.final_action && (
                    <span className="text-xs text-[var(--color-text-secondary)] font-mono hidden sm:inline">
                      by {getAdminName(application.final_action.admin)}
                    </span>
                  )}
                </div>
              </div>

              {/* MAIN CONTENT: 2x2 grid on left, actions on right */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-4">
                {/* Left: Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                {/* Submission Date & Time */}
                <div>
                  <p className="text-xs text-[var(--color-text-tertiary)] font-mono mb-1">Submitted</p>
                  <p className="text-sm text-[var(--color-text-primary)] font-mono">
                    {new Date(application.created_at).toLocaleString('pt-PT', {
                      timeZone: 'Europe/Lisbon',
                      year: 'numeric',
                      month: '2-digit', 
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Desired Arrival */}
                {(() => {
                  if (questions.length > 0 && application.data) {
                    const arrivalDateQuestion = questions.find(q => q.id === "ae5cc5b2-e2ec-4126-9e53-7ab7fc495324") as QuestionForAnswerRetrieval | undefined;
                    const arrivalDate = arrivalDateQuestion ? getAnswer(application.data, arrivalDateQuestion) : null;
                    if (arrivalDate && typeof arrivalDate === 'string') {
                      return (
                        <div>
                          <p className="text-xs text-[var(--color-text-tertiary)] font-mono mb-1">Wants to arrive</p>
                          <p className="text-sm text-[var(--color-text-primary)] font-mono">{arrivalDate.substring(0, 10)}</p>
                        </div>
                      );
                    }
                  }
                  return (
                    <div>
                      <p className="text-xs text-[var(--color-text-tertiary)] font-mono mb-1">Wants to arrive</p>
                      <p className="text-sm text-[var(--color-text-secondary)] font-mono">Not specified</p>
                    </div>
                  );
                })()}

                {/* Last Activity */}
                <div>
                  <p className="text-xs text-[var(--color-text-tertiary)] font-mono mb-1">Last active</p>
                  {application.last_sign_in_at ? (
                    <p className="text-sm text-[var(--color-text-primary)] font-mono">
                      {new Date(application.last_sign_in_at).toLocaleString('pt-PT', {
                        timeZone: 'Europe/Lisbon',
                        year: 'numeric',
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--color-text-secondary)] font-mono">Never</p>
                  )}
                </div>
                </div>

                {/* Right: Action Buttons (only for pending) */}
                {application.status === 'pending' && (
                  <div className="flex flex-row sm:flex-col gap-2 sm:gap-3 min-w-[120px] sm:min-w-[120px]">
                    <button
                      onClick={() => initiateApplicationAction(application, 'approve')}
                      disabled={loadingStates[application.id]}
                      className={`flex items-center justify-center gap-2 py-2 sm:py-3 px-3 sm:px-4 rounded-sm bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 hover:text-emerald-300 transition-colors font-mono text-xs sm:text-sm border border-emerald-500/30 flex-1 sm:flex-none ${
                        loadingStates[application.id] ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Approve</span>
                      <span className="sm:hidden">✓</span>
                    </button>
                    <button
                      onClick={() => initiateApplicationAction(application, 'reject')}
                      disabled={loadingStates[application.id]}
                      className={`flex items-center justify-center gap-2 py-2 sm:py-3 px-3 sm:px-4 rounded-sm bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 transition-colors font-mono text-xs sm:text-sm border border-red-400/30 flex-1 sm:flex-none ${
                        loadingStates[application.id] ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Reject</span>
                      <span className="sm:hidden">✗</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Comprehensive Status Bar */}
              <div className="flex flex-wrap gap-2 mb-4">
                {/* Whitelist Status */}
                {application.is_whitelisted ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/50 font-mono">
                    ✓ Whitelisted
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-800/50 text-slate-400 border border-slate-600/50 font-mono">
                    Not whitelisted
                  </span>
                )}

                {/* Credits Badge - Clickable for admins if they have credits, or always clickable for admins to add credits */}
                {isAdmin && application.credits !== undefined ? (
                  <button
                    onClick={() => handleManageCredits(application)}
                    className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-900/30 text-slate-400 border border-slate-700/50 font-mono hover:bg-slate-800/50 hover:text-slate-300 transition-colors cursor-pointer"
                    title="Click to manage credits"
                  >
                    € {application.credits} credits
                  </button>
                ) : application.credits !== undefined && application.credits > 0 ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-900/30 text-slate-400 border border-slate-700/50 font-mono">
                    € {application.credits} credits
                  </span>
                ) : isAdmin ? (
                  <button
                    onClick={() => handleManageCredits(application)}
                    className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-900/30 text-slate-400 border border-slate-700/50 font-mono hover:bg-slate-800/50 hover:text-slate-300 transition-colors cursor-pointer"
                    title="Click to manage credits"
                  >
                    € 0 credits
                  </button>
                ) : null}

                {/* Special Week Badge */}
                {(() => {
                  const specialWeeksQuestion = questions.find(q => q.id === "bfde0ed9-319a-45e4-8b0d-5c694ca2c850") as QuestionForAnswerRetrieval | undefined;
                  if (specialWeeksQuestion) {
                    const answer = getAnswer(application.data, specialWeeksQuestion);
                    if (answer && typeof answer === 'string' && answer !== "No<3" && answer !== "No <3") {
                      const programName = answer.split(" | ")[0] || answer;
                      return (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-amber-900/30 text-amber-400 border border-amber-700/50 font-mono">
                          🌟 {programName}
                        </span>
                      );
                    }
                  }
                  return null;
                })()}

                {/* Seen Welcome */}
                {application.seen_welcome && (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/50 font-mono">
                    ✓ Seen welcome
                  </span>
                )}

                {/* Linked Status */}
                {application.linked_name && (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-900/30 text-blue-400 border border-blue-700/50 font-mono">
                    👥 Linked with {application.linked_name}
                  </span>
                )}
              </div>

              {/* FOOTER: Admin Verdicts (minimized) + Hidden Delete */}
              <div className="pt-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                {/* Admin Verdicts - Compact */}
                {isAdmin && (
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                      {application.admin_verdicts && Object.keys(application.admin_verdicts).length > 0 ? (
                        (() => {
                          const currentAdminEmail = session?.user?.email || '';
                          const hasCurrentAdminVoted = application.admin_verdicts[currentAdminEmail];
                          
                          if (hasCurrentAdminVoted) {
                            // Show full verdicts if current admin has voted
                            return Object.entries(application.admin_verdicts).map(([email, verdict]) => (
                              <div
                                key={email}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
                                  verdict === 'thumbs_up'
                                    ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/50'
                                    : 'bg-red-900/30 text-red-400 border border-red-700/50'
                                }`}
                                title={`${getAdminName(email)}: ${verdict === 'thumbs_up' ? 'Thumbs up' : 'Thumbs down'}`}
                              >
                                {verdict === 'thumbs_up' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                                <span>{getAdminName(email)}</span>
                              </div>
                            ));
                          } else {
                            // Only show who has voted, not what they voted
                            return Object.keys(application.admin_verdicts).map((email) => (
                              <div
                                key={email}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono bg-slate-700/50 text-slate-400 border border-slate-600/50"
                                title={`${getAdminName(email)} has voted`}
                              >
                                <span>{getAdminName(email)} voted</span>
                              </div>
                            ));
                          }
                        })()
                      ) : (
                        <span className="text-xs text-[var(--color-text-tertiary)] font-mono">No admin verdicts</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                                             <button
                         onClick={() => updateAdminVerdict(application.id, 'thumbs_up')}
                         disabled={loadingStates[`${application.id}_verdict`]}
                         className={`p-1.5 rounded transition-colors border ${
                           application.admin_verdicts?.[session?.user?.email || ''] === 'thumbs_up'
                             ? 'bg-emerald-600/80 text-white border-emerald-500/50'
                             : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-emerald-600/60 hover:text-white hover:border-emerald-500/50'
                         } ${loadingStates[`${application.id}_verdict`] ? 'opacity-50 cursor-not-allowed' : ''}`}
                         title="Thumbs Up"
                       >
                         <ThumbsUp className="w-3 h-3" />
                       </button>
                       <button
                         onClick={() => updateAdminVerdict(application.id, 'thumbs_down')}
                         disabled={loadingStates[`${application.id}_verdict`]}
                         className={`p-1.5 rounded transition-colors border ${
                           application.admin_verdicts?.[session?.user?.email || ''] === 'thumbs_down'
                             ? 'bg-red-500/80 text-white border-red-400/50'
                             : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-red-500/60 hover:text-white hover:border-red-400/50'
                         } ${loadingStates[`${application.id}_verdict`] ? 'opacity-50 cursor-not-allowed' : ''}`}
                         title="Thumbs Down"
                       >
                         <ThumbsDown className="w-3 h-3" />
                       </button>
                    </div>
                  </div>
                )}

                {/* Delete Button - Hidden until hover, now isolated */}
                <div>
                  <button
                    onClick={() => openDeleteConfirmModal(application)}
                    disabled={loadingStates[application.id]}
                    className={`opacity-0 group-hover:opacity-100 p-2 rounded-sm bg-slate-600 text-white hover:bg-red-600 transition-all ${
                      loadingStates[application.id] ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Delete User & Application"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
          <div className="flex items-center space-x-1 order-1 sm:order-2 flex-wrap justify-center sm:justify-start">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || loading}
              className="px-2 sm:px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              <span className="hidden sm:inline">First</span>
              <span className="sm:hidden">1</span>
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              className="px-2 sm:px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              <span className="hidden sm:inline">Prev</span>
              <span className="sm:hidden">‹</span>
            </button>
            {paginationRange?.map((pageNumber, index) => {
              if (pageNumber === DOTS) {
                return <span key={`${pageNumber}-${index}`} className="px-2 sm:px-3 py-1.5 text-[var(--color-text-secondary)] font-mono text-xs">...</span>;
              }

              const pageNum = pageNumber as number;
              return (
                <button
                  key={`${pageNumber}-${index}`}
                  onClick={() => setCurrentPage(pageNum)}
                  disabled={loading}
                  className={`px-2 sm:px-3 py-1.5 rounded-sm font-mono text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
              className="px-2 sm:px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">›</span>
            </button>
            <button
              onClick={() => setCurrentPage(totalPageCount)}
              disabled={currentPage === totalPageCount || loading || totalPageCount === 0}
              className="px-2 sm:px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              <span className="hidden sm:inline">Last</span>
              <span className="sm:hidden">{totalPageCount}</span>
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
            className="bg-[var(--color-bg-surface)] p-6 md:p-8 rounded-sm shadow-2xl w-full max-w-md border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4 font-mono">Confirm User & Application Deletion</h2>
            <p className="text-[var(--color-text-secondary)] mb-1 font-mono">
              You are about to permanently delete the user <strong className="text-[var(--color-text-primary)]">{applicationToDelete.user_email}</strong>.
            </p>
            <p className="text-[var(--color-text-secondary)] mb-2 font-mono">This will also permanently delete:</p>
            <ul className="list-disc list-inside text-[var(--color-text-secondary)] mb-4 font-mono text-sm space-y-1 pl-4">
              <li>Their user account</li>
              <li>Their application</li>
              <li>All their associated bookings</li>
              <li>Their whitelist entry</li>
              <li>Their profile information</li>
            </ul>
            <p className="text-[var(--color-text-error)] mb-4 font-mono font-bold">
              This action is irreversible.
            </p>
            <p className="text-[var(--color-text-secondary)] mb-2 font-mono">
              To confirm, please type the user's email address below:
            </p>
            <input
              type="email"
              value={deleteConfirmationEmailInput}
              onChange={(e) => setDeleteConfirmationEmailInput(e.target.value)}
              placeholder={applicationToDelete.user_email}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-sm mb-6"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={closeDeleteConfirmModal}
                className="px-4 py-2 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteUserAndApplication}
                disabled={loadingStates[applicationToDelete.id] || deleteConfirmationEmailInput !== applicationToDelete.user_email}
                className={`px-4 py-2 rounded-sm bg-red-600 text-white hover:bg-red-700 transition-colors font-mono flex items-center justify-center ${
                  (loadingStates[applicationToDelete.id] || deleteConfirmationEmailInput !== applicationToDelete.user_email) ? 'opacity-50 cursor-not-allowed' : ''
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

      {/* Add Action Confirmation Modal */}
      {showActionConfirmModal && applicationToAction && actionType && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          onClick={closeActionConfirmModal}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-[var(--color-bg-surface)] p-6 md:p-8 rounded-sm shadow-2xl w-full max-w-md border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4 font-mono">
              Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-4 font-mono">
              Are you sure you want to {actionType === 'approve' ? 'approve' : 'reject'} the application for{' '}
              <strong className="text-[var(--color-text-primary)]">{applicationToAction.user_email}</strong>?
            </p>
            {actionType === 'approve' && (
              <p className="text-[var(--color-text-secondary)] mb-4 font-mono">
                This will send an approval email to the applicant and grant them access to the platform.
              </p>
            )}
            {actionType === 'reject' && (
              <p className="text-[var(--color-text-secondary)] mb-4 font-mono">
                This will send a rejection email to the applicant.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={closeActionConfirmModal}
                className="px-4 py-2 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] transition-colors font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={loadingStates[applicationToAction.id]}
                className={`px-4 py-2 rounded-sm transition-colors font-mono flex items-center justify-center ${
                  actionType === 'approve'
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                    : 'bg-red-600 text-white hover:bg-red-700'
                } ${loadingStates[applicationToAction.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loadingStates[applicationToAction.id] ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  actionType === 'approve' ? 'Approve' : 'Reject'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Manage Credits Modal */}
      {showManageCreditsModal && selectedApplicationForCredits && (
        <ManageCreditsModal
          application={selectedApplicationForCredits}
          onClose={() => {
            setShowManageCreditsModal(false);
            setSelectedApplicationForCredits(null);
          }}
          onCreditsUpdated={handleCreditsUpdated}
        />
      )}
    </div>
  );
}
