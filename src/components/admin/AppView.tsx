import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { ImageModal } from '../shared/ImageModal';
import { getFrontendUrl } from '../../lib/environment';
import { ApplicationDetails } from './ApplicationDetails';

interface Application {
  id: string;
  user_id: string;
  data: Record<string, any>;
  status: string;
  created_at: string;
  user_email: string;
}

const DISPLAY_QUESTIONS = {
  firstName: "First Name",
  lastName: "Last Name",
  photos: "What photo(s) of you best captures your essence? No more than 3, please.",
  astrology: "What, if anything, does astrology mean to you?",
  mbti: "If you know it, what is your MBTI type?",
  conspiracy: "What's your favorite conspiracy theory?",
  logicPuzzle: "If some robots are mechanics and some mechanics are purple, does it logically follow that some robots must be purple?",
  uniqueBelief: "What do you believe is true that most other people believe is false?",
  gettingToKnow: "What's your ideal way of getting to know a new person?",
  identity: "How do you identify yourself?",
  reallyKnowYou: "If we really knew you, what would we know?"
} as const;

function AnswerTooltip({ children, content }: { children: React.ReactNode; content: any }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const renderContent = (value: any) => {
    if (!value) return 'Not provided';
    if (typeof value === 'object') {
      if (value.answer) {
        let text = value.answer;
        if (value.role) text += `\nRole: ${value.role}`;
        if (value.partnerName) text += `\nPartner Name: ${value.partnerName}`;
        if (value.partnerEmail) text += `\nPartner Email: ${value.partnerEmail}`;
        return text;
      }
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <div className="relative">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className="cursor-pointer"
      >
        {children}
      </div>
      {showTooltip && (
        <div className="absolute z-50 bg-[var(--color-bg-surface-raised)] text-[var(--color-text-primary)] p-4 rounded-lg shadow-lg max-w-md whitespace-pre-wrap font-mono">
          {renderContent(content)}
        </div>
      )}
    </div>
  );
}

export function AppView() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    loadApplications();
    loadQuestions();
  }, []);

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

  const loadApplications = async () => {
    try {
      const { data, error: queryError } = await supabase
        .from('application_details')
        .select('id, user_id, data, status, created_at, user_email')
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

  const updateApplicationStatus = async (id: string, status: string) => {
    try {
      // Set loading state for this specific application
      setLoadingStates(prev => ({ ...prev, [id]: true }));

      if (status === 'approved') {
        const application = applications.find(app => app.id === id);
        console.log('AppView: Approving application', { id, email: application?.user_email });
        const { error } = await supabase.rpc('approve_application', {
          p_application_id: id
        });
        console.log('AppView: Approval result', { error });

        if (!error && application?.user_email) {
          // Send approval email
          const { error: emailError } = await supabase.functions.invoke('send-approval-email', {
            body: { 
              email: application.user_email,
              applicationId: id,
              frontendUrl: getFrontendUrl()
            }
          });
          console.log('AppView: Email sending result', { emailError });
        }
      } else if (status === 'rejected') {
        const application = applications.find(app => app.id === id);
        console.log('AppView: Rejecting application', { id, email: application?.user_email });
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
          console.log('AppView: Email sending result', { emailError });
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

  const renderPhotoGrid = (photos: any) => {
    if (!photos) return null;

    let photoUrls: string[] = [];
    try {
      if (Array.isArray(photos)) {
        photoUrls = photos.map(p => p.url).filter(Boolean);
      }
    } catch (e) {
      return null;
    }

    if (photoUrls.length === 0) return null;

    const gridConfig = {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-2',
      4: 'grid-cols-2'
    };

    return (
      <div className={`grid ${gridConfig[Math.min(photoUrls.length, 4) as keyof typeof gridConfig]} gap-2 aspect-square`}>
        {photoUrls.slice(0, 4).map((url, index) => (
          <img
            key={index}
            src={url}
            alt={`Applicant photo ${index + 1}`}
            className={`w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
              photoUrls.length === 3 && index === 2 ? 'col-span-2' : ''
            }`}
            onClick={() => setSelectedImage(url)}
          />
        ))}
      </div>
    );
  };

  const renderAnswer = (value: any) => {
    if (!value) return 'Not provided';
    if (typeof value === 'object') {
      if (value.answer) return value.answer;
      return JSON.stringify(value);
    }
    return String(value);
  };

  const renderApplicationCard = (application: Application) => {
    // Create a map of question text to order number
    const questionMap = Object.fromEntries(
      questions.map(q => [q.text, q.order_number])
    );

    // Get answers using the question map
    const firstName = application.data[questionMap[DISPLAY_QUESTIONS.firstName]];
    const lastName = application.data[questionMap[DISPLAY_QUESTIONS.lastName]];
    const photos = application.data[questionMap[DISPLAY_QUESTIONS.photos]];
    const astrology = application.data[questionMap[DISPLAY_QUESTIONS.astrology]];
    const mbti = application.data[questionMap[DISPLAY_QUESTIONS.mbti]];
    const conspiracy = application.data[questionMap[DISPLAY_QUESTIONS.conspiracy]];
    const logicPuzzle = application.data[questionMap[DISPLAY_QUESTIONS.logicPuzzle]];
    const uniqueBelief = application.data[questionMap[DISPLAY_QUESTIONS.uniqueBelief]];
    const gettingToKnow = application.data[questionMap[DISPLAY_QUESTIONS.gettingToKnow]];
    const identity = application.data[questionMap[DISPLAY_QUESTIONS.identity]];
    const reallyKnowYou = application.data[questionMap[DISPLAY_QUESTIONS.reallyKnowYou]];

    return (
      <motion.div
        key={application.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-[var(--color-bg-surface)] p-6 rounded-xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors space-y-6"
      >
        <div className="flex justify-between items-start">
          <div>
            <button
              onClick={() => setSelectedApplication(application)}
              className="font-mono text-base text-[var(--color-text-primary)] hover:text-[var(--color-accent-primary)] transition-colors text-left group"
            >
              <span className="group-hover:underline">
                {firstName} {lastName}
              </span>
            </button>
            <p className="text-[var(--color-text-secondary)] font-mono">{application.user_email}</p>
          </div>
          <div className="flex gap-2 items-center">
            {application.status === 'pending' && (
              <>
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
              </>
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

        {renderPhotoGrid(photos)}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[var(--color-text-secondary)] font-mono">Astrology:</span>
            <AnswerTooltip content={astrology}>
              <p className="mt-1 line-clamp-2 font-mono">{renderAnswer(astrology)}</p>
            </AnswerTooltip>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)] font-mono">MBTI:</span>
            <AnswerTooltip content={mbti}>
              <p className="mt-1 line-clamp-2 font-mono">{renderAnswer(mbti)}</p>
            </AnswerTooltip>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)] font-mono">Conspiracy Theory:</span>
            <AnswerTooltip content={conspiracy}>
              <p className="mt-1 line-clamp-2 font-mono">{renderAnswer(conspiracy)}</p>
            </AnswerTooltip>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)] font-mono">Logic Puzzle:</span>
            <AnswerTooltip content={logicPuzzle}>
              <p className="mt-1 line-clamp-2 font-mono">{renderAnswer(logicPuzzle)}</p>
            </AnswerTooltip>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)] font-mono">Unique Belief:</span>
            <AnswerTooltip content={uniqueBelief}>
              <p className="mt-1 line-clamp-2 font-mono">{renderAnswer(uniqueBelief)}</p>
            </AnswerTooltip>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)] font-mono">Getting to Know People:</span>
            <AnswerTooltip content={gettingToKnow}>
              <p className="mt-1 line-clamp-2 font-mono">{renderAnswer(gettingToKnow)}</p>
            </AnswerTooltip>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)] font-mono">Identity:</span>
            <AnswerTooltip content={identity}>
              <p className="mt-1 line-clamp-2 font-mono">{renderAnswer(identity)}</p>
            </AnswerTooltip>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)] font-mono">If we really knew you:</span>
            <AnswerTooltip content={reallyKnowYou}>
              <p className="mt-1 line-clamp-2 font-mono">{renderAnswer(reallyKnowYou)}</p>
            </AnswerTooltip>
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-primary)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[var(--color-bg-error)] text-[var(--color-text-error)] rounded-lg font-mono">
        {error}
      </div>
    );
  }

  const filteredApplications = applications.filter(app => app.status === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6 mt-4 ml-4">
        {(['pending', 'approved', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg transition-colors text-sm font-mono ${
              activeTab === tab
                ? 'bg-emerald-900 text-white'
                : 'bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] border border-[var(--color-border)]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
        <AnimatePresence>
          {filteredApplications.map(app => (
            renderApplicationCard(app)
          ))}
        </AnimatePresence>
      </div>

      {selectedApplication && (
        <ApplicationDetails
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
        />
      )}

      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}
