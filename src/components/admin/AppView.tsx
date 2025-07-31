import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, X as ClearSearchIcon } from 'lucide-react';
import { ImageModal } from '../shared/ImageModal';
import { SmartImage } from '../shared/SmartImage';
import { getFrontendUrl } from '../../lib/environment';
import { ApplicationDetails } from './ApplicationDetails';
import { getAnswer } from '../../lib/old_question_mapping';
import type { QuestionForAnswerRetrieval } from '../../lib/old_question_mapping';
import { usePagination, DOTS } from '../../hooks/usePagination';

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
  selfIdentify: "In your own words, how do you identify?",
  reallyKnowYou: "If we really knew you, what would we know?"
} as const;

const SELF_IDENTIFY_QUESTION_KEY = 'selfIdentify';
const SELF_IDENTIFY_OLD_ORDER_NUMBER = "22000";
const SELF_IDENTIFY_NEW_UUID = "702ae994-6f64-4e81-a2b3-2593fbc0c937";

const MBTI_QUESTION_KEY = 'mbti';
const MBTI_OLD_ORDER_NUMBER = "8500";
const MBTI_NEW_UUID = "241d9c89-0323-4003-9a20-7c19309ba488";

const ITEMS_PER_PAGE = 15;

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
        <div className="absolute z-50 bg-gray-800 text-[var(--color-text-primary)] p-4 rounded-sm shadow-lg max-w-md whitespace-pre-wrap font-mono">
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
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalApplicationsCount, setTotalApplicationsCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  React.useEffect(() => {
    loadApplications();
  }, [currentPage, activeTab, activeSearchQuery]);

  React.useEffect(() => {
    loadQuestions();
  }, []);

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

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError(null);

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('application_details')
        .select('id, user_id, data, status, created_at, user_email', { count: 'exact' });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
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

      query = query.order('created_at', { ascending: false });

      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;
      setApplications(data || []);
      setTotalApplicationsCount(count || 0);
    } catch (err) {
      console.error('Error loading applications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load applications');
      setApplications([]);
      setTotalApplicationsCount(0);
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
          <SmartImage
            key={index}
            src={url}
            alt={`Applicant photo ${index + 1}`}
            className={`w-full h-full object-cover rounded-sm cursor-pointer hover:opacity-90 transition-opacity ${
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
    const resolvedAnswers: Record<string, any> = {};

    const getSpecialAnswer = (
      appData: Record<string, any>,
      qKey: 'selfIdentify' | 'mbti', // Type this for safety
      qText: string,
      modernDefinition: QuestionForAnswerRetrieval | undefined,
      knownNewUuid: string,
      knownOldOrder: string
    ): any => {
      let ans: any;

      // 1. Try modern definition with getAnswer
      if (modernDefinition) {
        ans = getAnswer(appData, modernDefinition);
      }

      // 2. Fallback: direct lookup with modern UUID if getAnswer failed AND definition ID matches known UUID
      if (ans === undefined && modernDefinition && modernDefinition.id === knownNewUuid) {
        if (appData[knownNewUuid] !== undefined) {
          console.warn(`AppView: Fallback to direct lookup for ${qKey} (New UUID: ${knownNewUuid}) as getAnswer with modernDef (ID: ${modernDefinition.id}) failed for app ${application.id}.`);
          ans = appData[knownNewUuid];
        }
      }
      
      // If still no answer from modern path (neither getAnswer nor direct lookup with new UUID worked)
      if (ans === undefined) {
        const oldDefinitionForGetAnswer = { id: knownOldOrder, text: qText } as QuestionForAnswerRetrieval;
        // 3. Try old order number with getAnswer
        const oldAnsFromGetAnswer = getAnswer(appData, oldDefinitionForGetAnswer);

        if (oldAnsFromGetAnswer !== undefined) {
          ans = oldAnsFromGetAnswer;
        } else {
          // 4. Fallback: direct lookup with old order number if getAnswer with old ID also failed
          if (appData[knownOldOrder] !== undefined) {
            console.warn(`AppView: Fallback to direct lookup for ${qKey} (Old Order: ${knownOldOrder}) as getAnswer with old ID also failed for app ${application.id}.`);
            ans = appData[knownOldOrder];
          }
        }
      }
      return ans;
    };

    for (const keyInDisplayQuestions of Object.keys(DISPLAY_QUESTIONS) as Array<keyof typeof DISPLAY_QUESTIONS>) {
      const questionText = DISPLAY_QUESTIONS[keyInDisplayQuestions];
      const currentQuestionDefinition = questions.find(q => q.text === questionText) as QuestionForAnswerRetrieval | undefined;
      let answer: any;

      if (keyInDisplayQuestions === SELF_IDENTIFY_QUESTION_KEY) {
        answer = getSpecialAnswer(
          application.data, 
          SELF_IDENTIFY_QUESTION_KEY, 
          questionText, 
          currentQuestionDefinition, 
          SELF_IDENTIFY_NEW_UUID, 
          SELF_IDENTIFY_OLD_ORDER_NUMBER
        );
      } else if (keyInDisplayQuestions === MBTI_QUESTION_KEY) {
        answer = getSpecialAnswer(
          application.data,
          MBTI_QUESTION_KEY,
          questionText,
          currentQuestionDefinition,
          MBTI_NEW_UUID,
          MBTI_OLD_ORDER_NUMBER
        );
      } else if (currentQuestionDefinition) { // For other questions, use the found definition
        answer = getAnswer(application.data, currentQuestionDefinition);
      } else { 
        answer = undefined;
      }
      
      resolvedAnswers[keyInDisplayQuestions] = answer;

      // Logging for when an answer is ultimately not found
      if (answer === undefined) {
        if (keyInDisplayQuestions === SELF_IDENTIFY_QUESTION_KEY || keyInDisplayQuestions === MBTI_QUESTION_KEY) {
          console.warn(`AppView: For special question '${keyInDisplayQuestions}', all attempts failed to find an answer for app ${application.id}. Question text: "${questionText}". Modern def from DB: ${currentQuestionDefinition ? `ID: ${currentQuestionDefinition.id}, Text: ${currentQuestionDefinition.text}` : 'Not found'}. Known New UUID: ${keyInDisplayQuestions === SELF_IDENTIFY_QUESTION_KEY ? SELF_IDENTIFY_NEW_UUID : MBTI_NEW_UUID}, Known Old Order: ${keyInDisplayQuestions === SELF_IDENTIFY_QUESTION_KEY ? SELF_IDENTIFY_OLD_ORDER_NUMBER : MBTI_OLD_ORDER_NUMBER}.`);
        } else if (currentQuestionDefinition) {
          console.warn(`AppView: For standard question "${questionText}" (key: ${keyInDisplayQuestions}), getAnswer returned undefined even with a question definition (ID: ${currentQuestionDefinition.id}) for app ${application.id}.`);
        } else {
          console.warn(`AppView: Could not find question definition for standard key: ${keyInDisplayQuestions} or text: "${questionText}" for app ${application.id}. Ensure this question exists in 'application_questions_2' and DISPLAY_QUESTIONS is accurate.`);
        }
      }
    }

    // Get answers using the question map
    const firstName = resolvedAnswers.firstName;
    const lastName = resolvedAnswers.lastName;
    const photos = resolvedAnswers.photos;
    const astrology = resolvedAnswers.astrology;
    const mbti = resolvedAnswers.mbti;
    const conspiracy = resolvedAnswers.conspiracy;
    const logicPuzzle = resolvedAnswers.logicPuzzle;
    const uniqueBelief = resolvedAnswers.uniqueBelief;
    const gettingToKnow = resolvedAnswers.gettingToKnow;
    const selfIdentifyAnswer = resolvedAnswers.selfIdentify;
    const reallyKnowYou = resolvedAnswers.reallyKnowYou;

    return (
      <motion.div
        key={application.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-[var(--color-bg-surface)] p-6 rounded-md shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors space-y-6"
      >
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => setSelectedApplication(application)}
              className="font-mono text-2xl text-[var(--color-text-primary)] hover:text-[var(--color-accent-primary)] transition-colors text-left group w-full"
            >
              <span className="group-hover:underline break-words">
                {firstName} {lastName}
              </span>
            </button>
            <p className="text-[var(--color-text-primary)] font-mono text-md break-all">{application.user_email}</p>
            <p className="text-sm text-[var(--color-text-secondary)] font-mono mt-1">
              Submitted: {new Date(application.created_at).toISOString().slice(0, 10)}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium font-mono flex-shrink-0 ${
            application.status === 'pending'
              ? 'bg-yellow-100 text-yellow-800'
              : application.status === 'approved'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-rose-100 text-rose-800'
          }`}>
            {application.status}
          </span>
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
            <AnswerTooltip content={selfIdentifyAnswer}>
              <p className="mt-1 line-clamp-2 font-mono">{renderAnswer(selfIdentifyAnswer)}</p>
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



  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-primary)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[var(--color-bg-error)] text-[var(--color-text-error)] rounded-sm font-mono">
        {error}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-display mb-4 text-[var(--color-text-primary)]">Applications</h2>
      
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6 items-start sm:items-center">
        <div className="flex flex-wrap gap-2 min-w-0">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors text-xs whitespace-nowrap font-mono ${
                activeTab === tab
                  ? 'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/50'
                  : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] border border-[var(--color-border)]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 items-center flex-grow sm:flex-grow-0 min-w-0 w-full sm:w-auto">
          <input 
            type="text"
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleSearch(); }}
            className="px-2.5 py-1 border border-[var(--color-border)] rounded-md bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] font-mono text-xs flex-grow min-w-0"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {applications.map(app => (
            renderApplicationCard(app)
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 pb-4">
        <div className="font-mono text-sm text-[var(--color-text-secondary)] order-2 sm:order-1">
          Page {currentPage} of {totalPageCount > 0 ? totalPageCount : 1}
          {totalApplicationsCount > 0 && !activeSearchQuery &&
            ` (Showing ${((currentPage - 1) * ITEMS_PER_PAGE) + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, totalApplicationsCount)} of ${totalApplicationsCount})`
          }
          {totalApplicationsCount > 0 && activeSearchQuery &&
            ` (Found ${totalApplicationsCount} matching "${activeSearchQuery}")`
          }
          {totalApplicationsCount === 0 && activeSearchQuery && ` (No matches for "${activeSearchQuery}")`}
          {totalApplicationsCount === 0 && !activeSearchQuery && ` (No applications for this filter)`}
        </div>

        {totalPageCount > 0 && (
           <div className="flex items-center space-x-1 order-1 sm:order-2">
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
              disabled={currentPage === totalPageCount || loading || totalPageCount === 0}
              className="px-3 py-1.5 rounded-sm bg-[var(--color-button-secondary-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPageCount)}
              disabled={currentPage === totalPageCount || loading || totalPageCount === 0}
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

      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}


    </div>
  );
}
