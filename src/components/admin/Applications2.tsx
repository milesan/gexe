import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ApplicationDetails } from './ApplicationDetails';
import { motion, AnimatePresence } from 'framer-motion';
import { getFrontendUrl } from '../../lib/environment';

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
}

export function Applications2() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadApplications();
    loadQuestions();
  }, []);

  const loadApplications = async () => {
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
          linked_application_id
        `)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;
      setApplications(data || []);
    } catch (err) {
      console.error('Error loading applications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      const { data, error: queryError } = await supabase
        .from('application_questions')
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
      // Set loading state for this specific application
      setLoadingStates(prev => ({ ...prev, [id]: true }));

      if (status === 'approved') {
        const application = applications.find(app => app.id === id);
        console.log('Applications2: Approving application', { id, email: application?.user_email });
        const { error } = await supabase.rpc('approve_application', {
          p_application_id: id
        });
        console.log('Applications2: Approval result', { error });
        
        if (!error && application?.user_email) {
          // Send approval email
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
          // Send rejection email
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
      // Clear loading state for this specific application
      setLoadingStates(prev => ({ ...prev, [id]: false }));
    }
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
                    className="font-medium font-mono text-base text-[var(--color-text-primary)] hover:text-[var(--color-accent-primary)] transition-colors text-left group"
                  >
                    <span className="group-hover:underline">
                      {questions.length > 0 && application.data && (
                        <>
                          {application.data[questions[1]?.order_number]} {application.data[questions[2]?.order_number]}
                        </>
                      )}
                    </span>
                  </button>
                  <p className="text-sm text-[var(--color-text-secondary)] font-mono">
                    {application.user_email}
                  </p>
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
        />
      )}
    </div>
  );
}
