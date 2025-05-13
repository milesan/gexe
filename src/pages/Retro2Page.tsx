import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Retro2Form } from '../components/retro2/Retro2Form';
import { Retro2Intro } from '../components/retro2/Retro2Intro';
import { ConsentStep } from '../components/retro2/ConsentStep';
import type { ApplicationQuestion } from '../types/application';
import { supabase } from '../lib/supabase';
import { useAutosave } from '../hooks/useAutosave';

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
      console.log('🔄 Loading application questions and saved data...');
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('application_questions')
        .select('*')
        .order('order_number');

      if (queryError) throw queryError;
      
      const loadedQuestions = data || [];
      console.log('✅ All questions loaded:', loadedQuestions);
      setAllQuestions(loadedQuestions);

      // Separate consent question (assuming section 'intro')
      const consentQ = loadedQuestions.find(q => q.section?.toLowerCase() === 'intro') || null;
      const formQs = loadedQuestions.filter(q => q.section?.toLowerCase() !== 'intro');
      
      setConsentQuestion(consentQ);
      setFormQuestions(formQs);
      console.log(' แยก Consent Question:', consentQ);
      console.log('📋 Form Questions:', formQs);

      // Load saved form data
      const savedData = await loadSavedData();
      if (savedData) {
        console.log('💾 Loaded saved data:', savedData);
        setFormData(savedData);
        // Determine starting step based on saved consent
        if (consentQ && savedData[consentQ.order_number] === 'As you wish.') {
          console.log('Consent found in saved data, skipping to form.');
          setStep('form'); // User already consented
        } else {
          console.log('No consent in saved data, starting from intro/consent.');
          // Keep default step ('intro'), it will transition naturally
        }
      } else {
         console.log('No saved data found.');
         // Keep default step ('intro')
      }

    } catch (err) {
      console.error('❌ Error loading questions/data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handleIntroComplete = () => {
    console.log('[Retro2Page] Intro complete, moving to consent');
    setStep('consent');
  };

  const handleConsent = useCallback(() => {
    console.log('[Retro2Page] User consented');
    if (consentQuestion) {
      const consentValue = 'As you wish.'; // The value indicating consent
      const updatedFormData = { ...formData, [consentQuestion.order_number]: consentValue };
      setFormData(updatedFormData);
      console.log('💾 Saving consent answer...', updatedFormData);
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
      console.log('📝 Final form data for submission:', finalFormData);
      setFormData(finalFormData); // Ensure state has the absolute latest

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      console.log('👤 Current user:', user);

      // Use specific question IDs for names (ensure these exist and are in finalFormData)
      const FIRST_NAME_ID = 4000;
      const LAST_NAME_ID = 5000;
      
      const firstName = finalFormData[FIRST_NAME_ID] || '';
      const lastName = finalFormData[LAST_NAME_ID] || '';
      
      console.log('📋 Name from application:', { firstName, lastName });
      
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
            className="absolute inset-0"
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