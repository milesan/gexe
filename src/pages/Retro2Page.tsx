import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Retro2Form } from '../components/retro2/Retro2Form';
import { Retro2Intro } from '../components/retro2/Retro2Intro';
import { ConsentStep } from '../components/retro2/ConsentStep';
import type { ApplicationQuestion, VisibilityRules } from '../types/application';
import { supabase } from '../lib/supabase';
import { useAutosave } from '../hooks/useAutosave';
import { HISTORICAL_ORDER_NUMBER_TO_QUESTION_ID_MAP } from '../lib/old_question_mapping';

export function Retro2Page() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'intro' | 'consent' | 'form'>('intro');
  const [allQuestions, setAllQuestions] = useState<ApplicationQuestion[]>([]);
  const [consentQuestion, setConsentQuestion] = useState<ApplicationQuestion | null>(null);
  const [formQuestions, setFormQuestions] = useState<ApplicationQuestion[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { saveData, loadSavedData } = useAutosave();

  useEffect(() => {
    console.log('[Retro2Page] Component mounted');
    loadQuestionsAndData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadQuestionsAndData = async () => {
    try {
      console.log('🔄 [Retro2Page] Loading application questions and saved data...');
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('application_questions_2')
        .select('*')
        .order('order_number');

      if (queryError) {
        console.error('❌ [Retro2Page] Supabase query error:', queryError);
        throw queryError;
      }
      
      const rawQuestions = data || [];
      console.log('📋 [Retro2Page] Raw questions from Supabase:', JSON.stringify(rawQuestions, null, 2)); // Log raw data

      const processedQuestions: ApplicationQuestion[] = rawQuestions.map(q => {
        let parsedVisibilityRules: VisibilityRules | null = null;
        if (q.visibility_rules && typeof q.visibility_rules === 'string') {
          try {
            parsedVisibilityRules = JSON.parse(q.visibility_rules);
          } catch (e) {
            console.error(`❌ [Retro2Page] Error parsing visibility_rules for question ${q.id}:`, q.visibility_rules, e);
          }
        } else if (q.visibility_rules && typeof q.visibility_rules === 'object') {
          parsedVisibilityRules = q.visibility_rules as VisibilityRules;
        }
        
        // FIXED: Preserve options whether it's a string or already an array
        // The ApplicationQuestion type needs to support both formats
        return { 
          ...q, 
          visibility_rules: parsedVisibilityRules,
        };
      });
      
      console.log('✅ [Retro2Page] All questions processed:', JSON.stringify(processedQuestions, null, 2));
      setAllQuestions(processedQuestions);

      const foundConsentQ = processedQuestions.find(q => q.section?.toLowerCase() === 'intro') || null;
      console.log('❓ [Retro2Page] Consent question lookup result (should have section: intro):', JSON.stringify(foundConsentQ, null, 2));
      setConsentQuestion(foundConsentQ);

      const formQs = processedQuestions.filter(q => q.id !== foundConsentQ?.id);
      setFormQuestions(formQs);
      // console.log('📋 Form Questions:', formQs); // Keep this if needed for other debugging

      // Load saved form data
      const savedData = await loadSavedData();
      if (savedData && Object.keys(savedData).length > 0) {
        console.log('💾 Loaded raw saved data from useAutosave (expecting question_id keys):', savedData);
        
        setFormData(savedData);

        // Determine starting step based on saved consent (using consentQ.id and the correctly keyed savedData)
        if (foundConsentQ && savedData[foundConsentQ.id] === 'As you wish.') {
          console.log('Consent found directly in saved data (keyed by id), skipping to form.');
          setStep('form');
        } else {
          console.log('No consent in saved data (keyed by id), or consent not affirmative. Starting from intro/consent.');
          // Keep default step ('intro'), it will transition naturally
        }
      } else {
         console.log('No saved data found or saved data is empty.');
         // Keep default step ('intro')
      }

    } catch (err) {
      console.error('❌ Error loading questions/data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
      console.log('🏁 [Retro2Page] loadQuestionsAndData finished.');
    }
  };

  const handleIntroComplete = () => {
    console.log('[Retro2Page] Intro complete, moving to consent step.'); // Message changed slightly for clarity
    setStep('consent');
  };

  const handleConsent = useCallback(() => {
    console.log('[Retro2Page] User consented');
    if (consentQuestion) {
      const consentValue = 'As you wish.'; // The value indicating consent
      // Save consent with question.id as the key
      const updatedFormData = { ...formData, [consentQuestion.id]: consentValue };
      setFormData(updatedFormData);
      console.log('💾 Saving consent answer (keyed by id)...', updatedFormData);
      saveData(updatedFormData); // Save consent immediately
    }
    setStep('form');
  }, [consentQuestion, formData, saveData]);

  const handleReject = () => {
    console.log('[Retro2Page] User rejected consent');
    // Redirect or show a message
    window.location.href = 'https://www.youtube.com/watch?v=xvFZjo5PgG0';
  };

  // Centralized submit handler passed to Retro2Form
  const handleFormSubmit = async (finalFormData: any) => {
    try {
      console.log('🔄 Starting application submission...');
      console.log('📝 Final form data for submission (should be keyed by question.id):', finalFormData);
      setFormData(finalFormData); // Ensure state has the absolute latest

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      console.log('👤 Current user:', user);

      // Find First Name and Last Name question IDs dynamically
      const FIRST_NAME_QUESTION_ID = "39f455d1-0de8-438f-8f34-10818eaec15e";
      const LAST_NAME_QUESTION_ID = "246d0acf-25cd-4e4e-9434-765e6ea679cb";

      const firstNameQ = allQuestions.find(q => q.id === FIRST_NAME_QUESTION_ID);
      const lastNameQ = allQuestions.find(q => q.id === LAST_NAME_QUESTION_ID);

      const firstName = firstNameQ && finalFormData[firstNameQ.id] ? finalFormData[firstNameQ.id] : '';
      const lastName = lastNameQ && finalFormData[lastNameQ.id] ? finalFormData[lastNameQ.id] : '';
      
      if (!firstNameQ) console.warn(`Could not find 'First Name' question by ID '${FIRST_NAME_QUESTION_ID}'. Profile data might be incomplete.`);
      if (!lastNameQ) console.warn(`Could not find 'Last Name' question by ID '${LAST_NAME_QUESTION_ID}'. Profile data might be incomplete.`);
      
      console.log('📋 Name from application (using dynamic IDs):', { firstName, lastName });
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .upsert([
          { 
            id: user.id,
            email: user.email,
            first_name: firstName,
            last_name: lastName
          }
        ], { onConflict: 'id' })
        .select()
        .single();

      if (profileError) throw profileError;
      console.log('✅ Profile created/updated:', profileData);

      console.log('📤 Submitting application data...');
      const { data: application, error: applicationError } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          data: finalFormData, // Submit the complete formData
          status: 'pending'
        })
        .select()
        .single();

      if (applicationError) throw applicationError;
      console.log('✅ Application submitted:', application);

      console.log('🔄 Updating user metadata...');
      const { data: userData, error: updateError } = await supabase.auth.updateUser({
        data: { 
          has_applied: true,
          application_status: 'pending'
        }
      });

      if (updateError) throw updateError;
      console.log('✅ User metadata updated:', userData);

      console.log('🔄 Refreshing session...');
      const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError) throw sessionError;
      console.log('✅ Session refreshed:', sessionData);

      console.log('🎉 Application process completed successfully!');
      
      navigate('/pending');

    } catch (submissionError) {
      console.error('❌ Error in application submission process:', submissionError);
      setError(submissionError instanceof Error ? submissionError.message : 'Submission failed');
      // Don't re-throw here, let the user see the error on the page potentially
    }
  };

  // --- Enhanced logging before render --- 
  console.log(`[Retro2Page] Rendering. Current step: "${step}". Consent question set: ${!!consentQuestion}. Loading: ${loading}. Error: ${error}`);
  if (step === 'consent') {
    console.log('[Retro2Page] Attempting to render ConsentStep. consentQuestion details:', JSON.stringify(consentQuestion, null, 2));
  }
  // --- End enhanced logging ---

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-retro-accent"></div>
      </div>
    );
  }

  if (error) {
     return (
      <div className="fixed inset-0 bg-black flex flex-col justify-center items-center text-retro-accent p-4">
        <p className="text-xl mb-4">Error:</p>
        <p className="text-center">{error}</p>
        {/* Maybe add a retry button? */}
      </div>
    );
  }

  // --- Render logic based on step --- 
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <AnimatePresence initial={false}> 
        {step === 'intro' && (
          <motion.div
            key="intro"
            className="absolute inset-0"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }} // Faster exit
          >
            <Retro2Intro onComplete={handleIntroComplete} />
          </motion.div>
        )}

        {step === 'consent' && consentQuestion && (
          <motion.div
            key="consent"
            className="absolute inset-0 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            <ConsentStep 
              question={consentQuestion}
              onConsent={handleConsent}
              onReject={handleReject}
            />
          </motion.div>
        )}

        {step === 'form' && (
          <motion.div
            key="form"
            className="absolute inset-0 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.1 } }} // Slight delay for smoother feel
          >
            <Retro2Form
              questions={formQuestions}
              onSubmit={handleFormSubmit}
              initialData={formData} // Pass current formData which includes consent
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}