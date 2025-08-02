import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, CheckCircle, XCircle, Clock, Trash2, Search, X as ClearSearchIcon, ThumbsUp, ThumbsDown, Euro, ChevronDown, Check, Edit2, EyeOff, Columns } from 'lucide-react';
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
  tracking_status?: string;
  approved_on?: string | null;
  subsidy?: boolean;
  next_action?: string | null;
  on_sheet?: boolean;
  notes?: string | null;
  latest_booking_check_in?: string | null;
  reminder_email_sent?: boolean | null;
}

const ITEMS_PER_PAGE = 25;

interface Column {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean; // Some columns like Name and Email should always be visible
}

const DEFAULT_COLUMNS: Column[] = [
  { id: 'name', label: 'Name', visible: true, required: true },
  { id: 'email', label: 'Email', visible: true, required: true },
  { id: 'submitted', label: 'Submitted', visible: true },
  { id: 'lastActive', label: 'Last Active', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'tracking', label: 'Tracking', visible: true },
  { id: 'arrival', label: 'Arrival', visible: true },
  { id: 'approved', label: 'Approved', visible: true },
  { id: 'credits', label: '€ (credits)', visible: true },
  { id: 'subsidy', label: 'Subsidy', visible: true },
  { id: 'nextAction', label: 'Next Action', visible: true },
  { id: 'sheet', label: 'Sheet', visible: true },
  { id: 'reminder', label: 'Reminder', visible: true },
  { id: 'event', label: 'Event', visible: true },
  { id: 'notes', label: 'Notes', visible: true },
  { id: 'actions', label: 'Actions', visible: true, required: true },
];

const TRACKING_STATUS_OPTIONS = [
  null, // Empty option
  'new',
  'booked',
  'final reply',
  'replied',
  'awaiting',
  'booked + signed up',
  'withdrawn'
];

const NEXT_ACTION_OPTIONS = [
  null, // Empty option
  'send arrival info',
  'confirm sign-up theme',
  'collect payment',
  'send subsidy decision',
  'follow-up email'
];

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

interface EditableFieldProps {
  value: string | null | undefined;
  onSave: (value: string) => Promise<void>;
  options?: string[];
  placeholder?: string;
  isTextArea?: boolean;
}

interface StatusDropdownProps {
  application: Application;
  onAction: (action: 'approve' | 'reject') => void;
  disabled?: boolean;
}

function StatusDropdown({ application, onAction, disabled }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (application.status !== 'pending') {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium font-mono ${
        application.status === 'approved'
          ? 'bg-emerald-900/30 text-emerald-400'
          : 'bg-red-900/30 text-red-400'
      }`}>
        {application.status}
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="px-2 py-1 rounded-full text-xs font-medium font-mono bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors flex items-center gap-1"
      >
        pending
        <ChevronDown className="w-3 h-3" />
      </button>
      
      {isOpen && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-sm shadow-xl min-w-[120px]">
          <button
            onClick={() => {
              onAction('approve');
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 hover:bg-gray-800 text-left text-xs flex items-center gap-2 text-emerald-400"
          >
            <CheckCircle className="w-3 h-3" />
            Approve
          </button>
          <button
            onClick={() => {
              onAction('reject');
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 hover:bg-gray-800 text-left text-xs flex items-center gap-2 text-red-400 border-t border-gray-700"
          >
            <XCircle className="w-3 h-3" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function EditableField({ value, onSave, options, placeholder = 'Click to edit', isTextArea = false }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [showCustom, setShowCustom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  
  // Update editValue when value prop changes
  React.useEffect(() => {
    setEditValue(value || '');
  }, [value]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEditing(false);
        setShowCustom(false);
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEditing]);

  const handleSave = async () => {
    console.log('EditableField: Saving value:', editValue);
    setIsLoading(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
      setShowCustom(false);
    } catch (error) {
      console.error('EditableField: Failed to save:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
    setShowCustom(false);
  };

  if (!isEditing) {
    return (
      <div
        onClick={() => {
          setEditValue(value || '');
          setIsEditing(true);
        }}
        className={`cursor-pointer hover:bg-[var(--color-bg-surface-hover)] px-2 py-1 rounded-sm transition-colors flex items-center gap-1 min-h-[28px] group ${isTextArea ? 'max-w-[200px]' : ''}`}
      >
        <span className={`text-xs ${value ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)]'} ${isTextArea && value ? 'truncate' : ''}`}>
          {value || ''}
        </span>
        <Edit2 className="w-3 h-3 text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {options && !showCustom ? (
        <div className="absolute z-20 top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-sm shadow-xl min-w-[180px] max-h-[300px] overflow-y-auto">
          {options.map((option, index) => (
            <div
              key={option ?? `null-${index}`}
              onClick={async () => {
                console.log('EditableField: Option clicked:', option);
                setIsLoading(true);
                try {
                  await onSave(option || '');
                  setIsEditing(false);
                  setShowCustom(false);
                } catch (error) {
                  console.error('EditableField: Failed to save:', error);
                } finally {
                  setIsLoading(false);
                }
              }}
              className="px-3 py-2 hover:bg-gray-800 cursor-pointer text-xs flex items-center justify-between text-gray-200"
            >
              {option === null ? <span className="text-gray-500 italic">(empty)</span> : option}
              {value === option && <Check className="w-3 h-3 text-emerald-400" />}
            </div>
          ))}
          <div
            onClick={() => setShowCustom(true)}
            className="px-3 py-2 hover:bg-gray-800 cursor-pointer text-xs border-t border-gray-700 text-gray-400"
          >
            + Custom value
          </div>
        </div>
      ) : (
        <div className={`flex ${isTextArea ? 'flex-col' : 'items-center'} gap-1`}>
          {isTextArea ? (
            <>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancel();
                }}
                className="w-full px-2 py-1 text-xs border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] resize-y min-h-[60px]"
                autoFocus
                disabled={isLoading}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="p-1 rounded-sm bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 disabled:opacity-50"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="p-1 rounded-sm bg-red-500/20 text-red-400 hover:bg-red-500/40"
                >
                  <ClearSearchIcon className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
                className="px-2 py-1 text-xs border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)]"
                autoFocus
                disabled={isLoading}
              />
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="p-1 rounded-sm bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 disabled:opacity-50"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="p-1 rounded-sm bg-red-500/20 text-red-400 hover:bg-red-500/40"
              >
                <ClearSearchIcon className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ApplicationsTable() {
  const { session } = useSession();
  const { isAdmin } = useUserPermissions(session);
  const { refresh: refreshGlobalCredits } = useCredits();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalApplicationsCount, setTotalApplicationsCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_at_desc'); // Default sort by submitted date desc
  const [showManageCreditsModal, setShowManageCreditsModal] = useState(false);
  const [selectedApplicationForCredits, setSelectedApplicationForCredits] = useState<Application | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [showActionConfirmModal, setShowActionConfirmModal] = useState(false);
  const [applicationToAction, setApplicationToAction] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [approvedSortOrder, setApprovedSortOrder] = useState<'desc' | 'asc'>('desc');
  const [submittedSortOrder, setSubmittedSortOrder] = useState<'desc' | 'asc'>('desc');
  const [lastActiveSortOrder, setLastActiveSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null);
  const [deleteConfirmationEmailInput, setDeleteConfirmationEmailInput] = useState('');
  
  // Column visibility state
  const [columns, setColumns] = useState<Column[]>(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('applicationTableColumns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new columns
        return DEFAULT_COLUMNS.map(col => ({
          ...col,
          visible: parsed[col.id] !== undefined ? parsed[col.id] : col.visible
        }));
      } catch (e) {
        return DEFAULT_COLUMNS;
      }
    }
    return DEFAULT_COLUMNS;
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [columnMenuPosition, setColumnMenuPosition] = useState({ x: 0, y: 0 });

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
          final_action,
          tracking_status,
          approved_on,
          subsidy,
          next_action,
          on_sheet,
          notes,
          reminder_email_sent,
          latest_booking_check_in
        `, { count: 'exact' });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      if (activeSearchQuery) {
        // Search by email OR name OR event
        const firstNameQuestion = questions.find(q => q.id === "39f455d1-0de8-438f-8f34-10818eaec15e");
        const lastNameQuestion = questions.find(q => q.id === "246d0acf-25cd-4e4e-9434-765e6ea679cb");
        const themedResidencyQuestionId = "bfde0ed9-319a-45e4-8b0d-5c694ca2c850";
        
        if (firstNameQuestion && lastNameQuestion) {
          // Split search query by spaces for full name search
          const searchParts = activeSearchQuery.split(' ').filter(part => part.trim());
          
          if (searchParts.length > 1) {
            // For full name search, we need to filter in JavaScript after getting results
            // First get all potential matches
            const searchLower = activeSearchQuery.toLowerCase();
            query = query.or(`user_email.ilike.%${searchParts[0]}%,` +
              `user_email.ilike.%${searchParts[1]}%,` +
              `data->>${firstNameQuestion.id}.ilike.%${searchParts[0]}%,` +
              `data->>${firstNameQuestion.id}.ilike.%${searchParts[1]}%,` +
              `data->>${lastNameQuestion.id}.ilike.%${searchParts[0]}%,` +
              `data->>${lastNameQuestion.id}.ilike.%${searchParts[1]}%,` +
              `data->>${themedResidencyQuestionId}.ilike.%${activeSearchQuery}%`);
          } else {
            // Single term search
            query = query.or(`user_email.ilike.%${activeSearchQuery}%,data->>${firstNameQuestion.id}.ilike.%${activeSearchQuery}%,data->>${lastNameQuestion.id}.ilike.%${activeSearchQuery}%,data->>${themedResidencyQuestionId}.ilike.%${activeSearchQuery}%`);
          }
        } else {
          // Fallback to email-only search if questions not found
          query = query.ilike('user_email', `%${activeSearchQuery}%`);
        }
      }
      
      if (sortBy === 'arrival_date_asc') {
        const arrivalDateQuestion = questions.find(q => q.id === "ae5cc5b2-e2ec-4126-9e53-7ab7fc495324");
        if (arrivalDateQuestion) {
            query = query.order(`data->>${arrivalDateQuestion.id}`, { ascending: true, nullsFirst: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }
      } else if (sortBy === 'approved_on_desc' || sortBy === 'approved_on_asc') {
        const ascending = sortBy === 'approved_on_asc';
        query = query.order('approved_on', { ascending, nullsFirst: false });
      } else if (sortBy === 'created_at_desc' || sortBy === 'created_at_asc') {
        const ascending = sortBy === 'created_at_asc';
        query = query.order('created_at', { ascending });
      } else if (sortBy === 'last_sign_in_at_desc' || sortBy === 'last_sign_in_at_asc') {
        const ascending = sortBy === 'last_sign_in_at_asc';
        query = query.order('last_sign_in_at', { ascending, nullsFirst: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      console.log('ApplicationsTable: Raw data from query:', data?.[0]); // Log first item to see structure
      
      let processedApplications = (data || []).map(app => ({
        ...app,
        seen_welcome: !!app.raw_user_meta_data?.has_seen_welcome,
      }));

      // Filter for full name search if needed
      if (activeSearchQuery && activeSearchQuery.split(' ').filter(p => p.trim()).length > 1) {
        const searchLower = activeSearchQuery.toLowerCase();
        const firstNameQuestion = questions.find(q => q.id === "39f455d1-0de8-438f-8f34-10818eaec15e");
        const lastNameQuestion = questions.find(q => q.id === "246d0acf-25cd-4e4e-9434-765e6ea679cb");
        
        processedApplications = processedApplications.filter(app => {
          // Check email
          if (app.user_email.toLowerCase().includes(searchLower)) return true;
          
          // Check full name
          if (firstNameQuestion && lastNameQuestion && app.data) {
            const firstName = (app.data[firstNameQuestion.id] || '').toLowerCase();
            const lastName = (app.data[lastNameQuestion.id] || '').toLowerCase();
            const fullName = `${firstName} ${lastName}`;
            const reverseName = `${lastName} ${firstName}`;
            
            if (fullName.includes(searchLower) || reverseName.includes(searchLower)) return true;
          }
          
          // Check event name
          const eventAnswer = app.data?.["bfde0ed9-319a-45e4-8b0d-5c694ca2c850"] || '';
          if (eventAnswer.toLowerCase().includes(searchLower)) return true;
          
          return false;
        });
      }

      // Fetch whitelist status
      const emails = processedApplications.map(app => app.user_email);
      const { data: whitelistData } = await supabase
        .from('whitelist')
        .select('email')
        .in('email', emails);
      
      const whitelistedEmails = new Set(whitelistData?.map(w => w.email) || []);

      const applicationsWithWhitelist = processedApplications.map(app => ({
        ...app,
        is_whitelisted: whitelistedEmails.has(app.user_email)
      }));

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
  }, [filter, currentPage, activeSearchQuery, supabase, sortBy, questions]);

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

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadApplications();
  }, [loadApplications]);

  const updateApplicationStatus = async (id: string, status: string) => {
    try {
      setLoadingStates(prev => ({ ...prev, [id]: true }));

      if (status === 'approved') {
        const application = applications.find(app => app.id === id);
        const { error } = await supabase.rpc('approve_application', {
          p_application_id: id
        });
        
        if (!error && application?.user_email) {
          await supabase.functions.invoke('send-approval-email', {
            body: { 
              email: application.user_email,
              applicationId: id,
              frontendUrl: getFrontendUrl()
            }
          });
        }
      } else if (status === 'rejected') {
        const application = applications.find(app => app.id === id);
        const { error } = await supabase.rpc('reject_application', {
          p_application_id: id
        });
        
        if (!error && application?.user_email) {
          await supabase.functions.invoke('send-rejection-email', {
            body: { 
              email: application.user_email,
              applicationId: id
            }
          });
        }
      }
      await loadApplications();
    } catch (err) {
      console.error('Error updating application:', err);
      setError(err instanceof Error ? err.message : 'Failed to update application');
    } finally {
      setLoadingStates(prev => ({ ...prev, [id]: false }));
    }
  };

  const updateTrackingField = async (applicationId: string, field: string, value: string) => {
    console.log('ApplicationsTable: Updating field', { applicationId, field, value });
    try {
      const { error } = await supabase.rpc('update_application_tracking_field', {
        p_application_id: applicationId,
        p_field: field,
        p_value: value === '' ? null : value
      });

      if (error) {
        console.error('ApplicationsTable: RPC error:', error);
        throw error;
      }
      console.log('ApplicationsTable: Field updated successfully, reloading...');
      await loadApplications();
    } catch (err) {
      console.error('ApplicationsTable: Error updating field:', err);
      throw err;
    }
  };

  const toggleBooleanField = async (applicationId: string, field: string) => {
    console.log('ApplicationsTable: Toggling boolean field', { applicationId, field });
    try {
      if (field === 'reminder_email_sent') {
        // For reminder_email_sent, we need to toggle it on the user's booking
        const application = applications.find(a => a.id === applicationId);
        if (!application) {
          console.error('ApplicationsTable: Application not found');
          return;
        }

        const { error } = await supabase.rpc('toggle_booking_reminder_for_user', {
          p_user_id: application.user_id
        });

        if (error) {
          console.error('ApplicationsTable: RPC error:', error);
          throw error;
        }
      } else {
        // For other fields, use the existing toggle function
        const { error } = await supabase.rpc('toggle_application_tracking_field', {
          p_application_id: applicationId,
          p_field: field
        });

        if (error) {
          console.error('ApplicationsTable: RPC error:', error);
          throw error;
        }
      }
      console.log('ApplicationsTable: Boolean field toggled successfully, reloading...');
      await loadApplications();
    } catch (err) {
      console.error('ApplicationsTable: Error toggling field:', err);
    }
  };

  const handleManageCredits = (application: Application) => {
    setSelectedApplicationForCredits(application);
    setShowManageCreditsModal(true);
  };

  const handleCreditsUpdated = async (userId: string, newBalance: number) => {
    setApplications(prev => prev.map(app => 
      app.user_id === userId 
        ? { ...app, credits: newBalance }
        : app
    ));
    
    const currentUserId = session?.user?.id;
    if (currentUserId === userId) {
      await refreshGlobalCredits();
    }
  };

  const initiateApplicationAction = (application: Application, action: 'approve' | 'reject') => {
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

  const handleApprovedSort = () => {
    let newOrder: 'desc' | 'asc' = 'desc';
    
    // Only toggle if we're already sorting by this column
    if (sortBy.startsWith('approved_on')) {
      newOrder = approvedSortOrder === 'desc' ? 'asc' : 'desc';
    }
    
    setApprovedSortOrder(newOrder);
    setSortBy(`approved_on_${newOrder}`);
    setCurrentPage(1);
    
    // Reset other sort orders to desc
    setSubmittedSortOrder('desc');
    setLastActiveSortOrder('desc');
  };

  const handleSubmittedSort = () => {
    let newOrder: 'desc' | 'asc' = 'desc';
    
    // Only toggle if we're already sorting by this column
    if (sortBy.startsWith('created_at')) {
      newOrder = submittedSortOrder === 'desc' ? 'asc' : 'desc';
    }
    
    setSubmittedSortOrder(newOrder);
    setSortBy(`created_at_${newOrder}`);
    setCurrentPage(1);
    
    // Reset other sort orders to desc
    setApprovedSortOrder('desc');
    setLastActiveSortOrder('desc');
  };

  const handleLastActiveSort = () => {
    let newOrder: 'desc' | 'asc' = 'desc';
    
    // Only toggle if we're already sorting by this column
    if (sortBy.startsWith('last_sign_in_at')) {
      newOrder = lastActiveSortOrder === 'desc' ? 'asc' : 'desc';
    }
    
    setLastActiveSortOrder(newOrder);
    setSortBy(`last_sign_in_at_${newOrder}`);
    setCurrentPage(1);
    
    // Reset other sort orders to desc
    setApprovedSortOrder('desc');
    setSubmittedSortOrder('desc');
  };

  const handleConfirmDeleteUserAndApplication = async () => {
    if (!applicationToDelete || deleteConfirmationEmailInput !== applicationToDelete.user_email) return;

    const { id: applicationId, user_id: userId, user_email: userEmail } = applicationToDelete;
    try {
      setLoadingStates(prev => ({ ...prev, [applicationId]: true }));
      setError(null);

      console.log(`ApplicationsTable: Attempting to delete auth user ${userId} (${userEmail})`);
      // Step 1: Delete the auth user via Edge Function
      const { error: authUserDeleteError } = await supabase.functions.invoke('delete-auth-user', {
        body: { userId: userId }
      });

      if (authUserDeleteError) {
        console.error('Error deleting auth user:', authUserDeleteError);
        throw new Error(`Failed to delete user account: ${authUserDeleteError.message}`);
      }
      console.log(`ApplicationsTable: Auth user ${userId} deleted successfully.`);

      console.log('ApplicationsTable: Application record should be cascade deleted.', { applicationId });
      
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

  const toggleColumn = (columnId: string) => {
    const newColumns = columns.map(col => 
      col.id === columnId && !col.required 
        ? { ...col, visible: !col.visible }
        : col
    );
    setColumns(newColumns);
    
    // Save to localStorage
    const visibilityMap = newColumns.reduce((acc, col) => ({
      ...acc,
      [col.id]: col.visible
    }), {});
    localStorage.setItem('applicationTableColumns', JSON.stringify(visibilityMap));
  };

  const handleTableContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setColumnMenuPosition({ x: e.clientX, y: e.clientY });
    setShowColumnMenu(true);
  };

  const handleColumnMenuClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 250); // Ensure menu stays on screen
    const y = rect.bottom + 5;
    setColumnMenuPosition({ x, y });
    setShowColumnMenu(!showColumnMenu);
  };

  // Close column menu when clicking outside or scrolling
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Don't close if clicking inside the menu
      const target = e.target as HTMLElement;
      if (!target.closest('.column-menu')) {
        setShowColumnMenu(false);
      }
    };
    
    const handleScroll = () => {
      setShowColumnMenu(false);
    };
    
    if (showColumnMenu) {
      // Add delay to prevent immediate closing
      setTimeout(() => {
        document.addEventListener('click', handleClick);
        document.addEventListener('scroll', handleScroll, true); // Use capture to catch all scroll events
      }, 0);
      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [showColumnMenu]);

  const isColumnVisible = (columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    return column ? column.visible : true;
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
    <div className="p-3 sm:p-6">
      {error && (
        <div className="mb-6 p-4 bg-[var(--color-bg-error)] text-[var(--color-text-error)] rounded-sm">
          {error}
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6 items-start sm:items-center">
        <div className="flex flex-wrap gap-2 min-w-0">
          <button
            onClick={() => { setFilter('all'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs whitespace-nowrap font-mono ${
              filter === 'all'
                ? 'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/50'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setFilter('pending'); setCurrentPage(1); }}
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
            onClick={() => { setFilter('approved'); setCurrentPage(1); }}
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
            onClick={() => { setFilter('rejected'); setCurrentPage(1); }}
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

        <div className="flex gap-1.5 items-center flex-grow">
          <input 
            type="text"
            placeholder="Search by email, name, or event..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') { setActiveSearchQuery(searchTerm.trim()); setCurrentPage(1); } }}
            className="px-2.5 py-1 border border-[var(--color-border)] rounded-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-xs flex-grow min-w-[250px]"
          />
          <button
            onClick={() => { setActiveSearchQuery(searchTerm.trim()); setCurrentPage(1); }}
            className="p-1.5 rounded-md bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)] flex-shrink-0"
            title="Search"
          >
            <Search className="w-3 h-3" />
          </button>
          {activeSearchQuery && (
            <button
              onClick={() => { setSearchTerm(''); setActiveSearchQuery(''); setCurrentPage(1); }}
              className="p-1.5 rounded-md bg-[var(--color-bg-surface)] text-[var(--color-text-error)] hover:bg-[var(--color-error-bg-hover)] border border-[var(--color-border)] flex-shrink-0"
              title="Clear Search"
            >
              <ClearSearchIcon className="w-3 h-3" />
            </button>
          )}
        </div>
        
        <button
          onClick={handleColumnMenuClick}
          className="p-1.5 rounded-md bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)] flex-shrink-0"
          title="Column visibility"
        >
          <Columns className="w-3 h-3" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto" onContextMenu={handleTableContextMenu}>
        <table className="w-full min-w-[1700px]">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {isColumnVisible('name') && <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">Name</th>}
              {isColumnVisible('email') && <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">Email</th>}
              {isColumnVisible('submitted') && (
                <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">
                  <button
                    onClick={handleSubmittedSort}
                    className="hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-1"
                  >
                    Submitted
                    {sortBy.startsWith('created_at') && (
                      <span className="text-[var(--color-accent-primary)]">
                        {submittedSortOrder === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </button>
                </th>
              )}
              {isColumnVisible('lastActive') && (
                <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">
                  <button
                    onClick={handleLastActiveSort}
                    className="hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-1"
                  >
                    Last Active
                    {sortBy.startsWith('last_sign_in_at') && (
                      <span className="text-[var(--color-accent-primary)]">
                        {lastActiveSortOrder === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </button>
                </th>
              )}
              {isColumnVisible('status') && <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">Status</th>}
              {isColumnVisible('tracking') && (
                <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">
                  <span 
                    className="cursor-help" 
                    title="Status automatically changes to 'booked' when booking is made. When cancelled, status remains 'booked' for flexibility - admin must update manually if needed"
                  >
                    Tracking
                  </span>
                </th>
              )}
              {isColumnVisible('arrival') && (
                <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">
                  <span 
                    className="cursor-help" 
                    title="Shows actual booking check-in date if booked, otherwise shows requested arrival date from application"
                  >
                    Arrival
                  </span>
                </th>
              )}
              {isColumnVisible('approved') && (
                <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">
                  <button
                    onClick={handleApprovedSort}
                    className="hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-1"
                  >
                    Approved
                    {sortBy.startsWith('approved_on') && (
                      <span className="text-[var(--color-accent-primary)]">
                        {approvedSortOrder === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </button>
                </th>
              )}
              {isColumnVisible('credits') && (
                <th className="text-center p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">
                  <span 
                    className="cursor-help inline-flex items-center gap-1" 
                    title="User's credit balance - Credits are used to pay for stays. Click on the amount to manage credits."
                  >
                    €
                    <span className="text-[10px] opacity-60">(credits)</span>
                  </span>
                </th>
              )}
              {isColumnVisible('subsidy') && (
                <th className="text-center p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">
                  <span 
                    className="cursor-help" 
                    title="Subsidy - Check if this user receives a subsidy/discount"
                  >
                    Subsidy
                  </span>
                </th>
              )}
              {isColumnVisible('nextAction') && <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">Next Action</th>}
              {isColumnVisible('sheet') && <th className="text-center p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">Sheet</th>}
              {isColumnVisible('reminder') && (
                <th className="text-center p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">
                  <span 
                    className="cursor-help" 
                    title="Booking Reminder - Shows if reminder email has been sent. Click checkbox to toggle on/off (only available when user has a booking)"
                  >
                    Reminder
                  </span>
                </th>
              )}
              {isColumnVisible('event') && <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">Event</th>}
              {isColumnVisible('notes') && <th className="text-left p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">Notes</th>}
              {isColumnVisible('actions') && <th className="text-center p-2 text-xs font-mono font-normal text-[var(--color-text-secondary)]">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {applications.map((application, index) => {
              const firstName = questions.length > 0 && application.data ? 
                getAnswer(application.data, questions.find(q => q.text === "First Name") as QuestionForAnswerRetrieval) || '' : '';
              const lastName = questions.length > 0 && application.data ? 
                getAnswer(application.data, questions.find(q => q.text === "Last Name") as QuestionForAnswerRetrieval) || '' : '';
              const arrivalDate = questions.length > 0 && application.data ? 
                getAnswer(application.data, questions.find(q => q.id === "ae5cc5b2-e2ec-4126-9e53-7ab7fc495324") as QuestionForAnswerRetrieval) : null;
              const themedResidency = questions.length > 0 && application.data ?
                getAnswer(application.data, questions.find(q => q.id === "bfde0ed9-319a-45e4-8b0d-5c694ca2c850") as QuestionForAnswerRetrieval) : null;

              // Log tracking status for debugging
              if (index === 0) {
                console.log('ApplicationsTable: First application tracking data:', {
                  tracking_status: application.tracking_status,
                  next_action: application.next_action,
                  subsidy: application.subsidy,
                  on_sheet: application.on_sheet,
                  notes: application.notes,
                  reminder_email_sent: application.reminder_email_sent
                });
              }

              return (
                <tr 
                  key={application.id} 
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-surface)] group"
                >
                  {isColumnVisible('name') && (
                    <td className="p-2">
                      <div 
                        className="cursor-pointer hover:text-[var(--color-accent-primary)] hover:underline"
                        onClick={() => setSelectedApplication(application)}
                      >
                        <p className="text-xs font-mono text-[var(--color-text-primary)]">
                          {`${firstName} ${lastName}`.trim() || "No Name"}
                        </p>
                      </div>
                    </td>
                  )}
                  {isColumnVisible('email') && (
                    <td className="p-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(application.user_email);
                          setCopiedEmail(application.user_email);
                          setTimeout(() => setCopiedEmail(null), 1000);
                        }}
                        className="text-xs font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition-colors cursor-pointer"
                      >
                        {copiedEmail === application.user_email ? 'Copied!' : application.user_email}
                      </button>
                    </td>
                  )}
                  {isColumnVisible('submitted') && (
                    <td className="p-2">
                      <p className="text-xs font-mono text-[var(--color-text-primary)]">
                        {new Date(application.created_at).toLocaleString('sv-SE', {
                          timeZone: 'Europe/Lisbon',
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }).replace(' ', ' ')}
                      </p>
                    </td>
                  )}
                  {isColumnVisible('lastActive') && (
                    <td className="p-2">
                      <p className="text-xs font-mono text-[var(--color-text-primary)]">
                        {application.last_sign_in_at 
                          ? new Date(application.last_sign_in_at).toLocaleString('sv-SE', {
                              timeZone: 'Europe/Lisbon',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            }).replace(' ', ' ')
                          : 'Never'}
                      </p>
                    </td>
                  )}
                  {isColumnVisible('status') && (
                    <td className="p-2">
                      <StatusDropdown
                        application={application}
                        onAction={(action) => initiateApplicationAction(application, action)}
                        disabled={loadingStates[application.id]}
                      />
                    </td>
                  )}
                  {isColumnVisible('tracking') && (
                    <td className="p-2">
                      <EditableField
                        value={application.tracking_status}
                        onSave={(value) => updateTrackingField(application.id, 'tracking_status', value)}
                        options={TRACKING_STATUS_OPTIONS}
                      />
                    </td>
                  )}
                  {isColumnVisible('arrival') && (
                    <td className="p-2">
                      <p className="text-xs font-mono text-[var(--color-text-primary)]">
                        {application.latest_booking_check_in 
                          ? new Date(application.latest_booking_check_in).toISOString().split('T')[0]
                          : arrivalDate 
                          ? arrivalDate.substring(0, 10) 
                          : '-'}
                      </p>
                    </td>
                  )}
                  {isColumnVisible('approved') && (
                    <td className="p-2">
                      <p className="text-xs font-mono text-[var(--color-text-primary)]">
                        {application.approved_on ? new Date(application.approved_on).toISOString().split('T')[0] : '-'}
                      </p>
                    </td>
                  )}
                  {isColumnVisible('credits') && (
                    <td className="p-2 text-center">
                      {isAdmin ? (
                        <button
                          onClick={() => handleManageCredits(application)}
                          className="w-full px-2 py-1 text-xs font-mono hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-accent-primary)] transition-colors rounded-sm"
                          title="Click to manage credits"
                        >
                          {application.credits || 0}
                        </button>
                      ) : (
                        <span className="text-xs font-mono">{application.credits || 0}</span>
                      )}
                    </td>
                  )}
                  {isColumnVisible('subsidy') && (
                    <td className="p-2 text-center">
                      <button
                        onClick={() => toggleBooleanField(application.id, 'subsidy')}
                        className="p-1 rounded hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                      >
                        {application.subsidy ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <div className="w-3 h-3 border border-[var(--color-border)] rounded-sm" />
                        )}
                      </button>
                    </td>
                  )}
                  {isColumnVisible('nextAction') && (
                    <td className="p-2">
                      <EditableField
                        value={application.next_action}
                        onSave={(value) => updateTrackingField(application.id, 'next_action', value)}
                        options={NEXT_ACTION_OPTIONS}
                        placeholder="Select action"
                      />
                    </td>
                  )}
                  {isColumnVisible('sheet') && (
                    <td className="p-2 text-center">
                      <button
                        onClick={() => toggleBooleanField(application.id, 'on_sheet')}
                        className="p-1 rounded hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                      >
                        {application.on_sheet ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <div className="w-3 h-3 border border-[var(--color-border)] rounded-sm" />
                        )}
                      </button>
                    </td>
                  )}
                  {isColumnVisible('reminder') && (
                    <td className="p-2 text-center">
                      <button
                        onClick={() => toggleBooleanField(application.id, 'reminder_email_sent')}
                        className="p-1 rounded hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                        title={application.reminder_email_sent ? 'Booking reminder sent - click to mark as not sent' : 'No booking reminder sent - click to mark as sent'}
                        disabled={!application.latest_booking_check_in}
                      >
                        {application.reminder_email_sent ? (
                          <Check className="w-3 h-3 text-blue-400" />
                        ) : (
                          <div className="w-3 h-3 border border-[var(--color-border)] rounded-sm" />
                        )}
                      </button>
                    </td>
                  )}
                  {isColumnVisible('event') && (
                    <td className="p-2">
                      {themedResidency && themedResidency !== "No<3" && themedResidency !== "No <3" ? (
                        <span className="text-xs font-mono text-[var(--color-text-primary)]">
                          {themedResidency.split(" | ")[0]}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-[var(--color-text-tertiary)]">-</span>
                      )}
                    </td>
                  )}
                  {isColumnVisible('notes') && (
                    <td className="p-2 max-w-[200px]">
                      <EditableField
                        value={application.notes}
                        onSave={(value) => updateTrackingField(application.id, 'notes', value)}
                        placeholder="Add note..."
                        isTextArea={true}
                      />
                    </td>
                  )}
                  {isColumnVisible('actions') && (
                    <td className="p-2 text-center">
                      <button
                        onClick={() => openDeleteConfirmModal(application)}
                        disabled={loadingStates[application.id]}
                        className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-sm bg-slate-600 text-white hover:bg-red-600 transition-all ${
                          loadingStates[application.id] ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Delete User & Application"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {applications.length === 0 && !loading && (
        <div className="text-center py-10 text-[var(--color-text-secondary)] font-mono">
          No applications found.
        </div>
      )}

      {/* Pagination */}
      <div className="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
        <div className="font-mono text-sm text-[var(--color-text-secondary)]">
          Page {currentPage} of {totalPageCount > 0 ? totalPageCount : 1}
          {totalApplicationsCount > 0 && ` (${totalApplicationsCount} total)`}
        </div>

        {totalPageCount > 1 && (
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
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
                  className={`px-3 py-1.5 rounded-sm font-mono text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
              disabled={currentPage === totalPageCount || loading}
              className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPageCount)}
              disabled={currentPage === totalPageCount || loading}
              className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
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

      {/* Column Visibility Menu */}
      {showColumnMenu && (
        <div
          className="column-menu fixed bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-sm shadow-xl p-2 z-50 min-w-[200px]"
          style={{ left: columnMenuPosition.x, top: columnMenuPosition.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-mono text-[var(--color-text-secondary)] mb-2 px-2">
            Show/Hide Columns
          </div>
          {columns.map(col => (
            <button
              key={col.id}
              onClick={() => toggleColumn(col.id)}
              disabled={col.required}
              className={`w-full text-left px-2 py-1 text-xs hover:bg-[var(--color-bg-surface-hover)] flex items-center gap-2 ${
                col.required ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className={`w-3 h-3 border border-[var(--color-border)] rounded-sm flex items-center justify-center ${
                col.visible ? 'bg-emerald-600 border-emerald-600' : ''
              }`}>
                {col.visible && <Check className="w-2 h-2 text-white" />}
              </div>
              {col.label}
            </button>
          ))}
        </div>
      )}

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

      {/* Action Confirmation Modal */}
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

      {/* Delete Confirmation Modal */}
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
    </div>
  );
}