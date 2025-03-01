import React, { useState } from 'react';
import { Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Retro2Form } from '../components/retro2/Retro2Form';
import { Retro2Intro } from '../components/retro2/Retro2Intro';
import type { ApplicationQuestion } from '../types/application';
import { useNavigate } from 'react-router-dom';

export function Retro2Page() {
  const [showForm, setShowForm] = useState(false);
  const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      console.log('🔄 Loading application questions...');
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('application_questions')
        .select('*')
        .order('order_number');

      if (queryError) throw queryError;
      
      // Validate question structure
      if (data && data.length > 0) {
        const sampleQuestion = data[0];
        console.log('📋 Question structure validation:', {
          hasId: 'id' in sampleQuestion,
          hasText: 'text' in sampleQuestion,
          actualKeys: Object.keys(sampleQuestion),
          sampleQuestion
        });
      }
      
      console.log('✅ Questions loaded:', data);
      setQuestions(data || []);
    } catch (err) {
      console.error('❌ Error loading questions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      console.log('🔄 Starting application submission...');
      console.log('📝 Form data received:', data);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      console.log('👤 Current user:', user);

      // Create or update profile with name from application
      // Use specific question IDs that we know exist in the database
      const FIRST_NAME_ID = 4000;
      const LAST_NAME_ID = 5000;
      
      const firstName = data[FIRST_NAME_ID] || '';
      const lastName = data[LAST_NAME_ID] || '';
      
      console.log('📋 Name from application:', { 
        firstName,
        lastName
      });
      
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

      console.log('👤 Profile update result:', {
        success: !profileError,
        data: profileData,
        error: profileError
      });

      if (profileError) throw profileError;
      console.log('✅ Profile created/updated:', profileData);

      // Check if this is a linked application
      const isLinkedApplication = data[9]?.answer === "Yes";
      const linkedName = isLinkedApplication ? data[9].partnerName : null;
      const linkedEmail = isLinkedApplication ? data[9].partnerEmail : null;
      console.log('🔗 Linked application info:', { isLinkedApplication, linkedName, linkedEmail });

      // Submit the application
      console.log('📤 Submitting application...');
      const { data: application, error: applicationError } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          data: data,
          status: 'pending'
        })
        .select()
        .single();

      if (applicationError) throw applicationError;
      console.log('✅ Application submitted:', application);

      // If there's a linked application, create the link
      if (isLinkedApplication && linkedName && linkedEmail && application) {
        console.log('🔗 Creating linked application...');
        const { data: linkedData, error: linkError } = await supabase
          .from('linked_applications')
          .insert({
            primary_application_id: application.id,
            linked_name: linkedName,
            linked_email: linkedEmail
          })
          .select()
          .single();

        if (linkError) throw linkError;
        console.log('✅ Linked application created:', linkedData);
      }

      // Update user metadata
      console.log('🔄 Updating user metadata...');
      const { data: userData, error: updateError } = await supabase.auth.updateUser({
        data: { 
          has_applied: true,
          application_status: 'pending'
        }
      });

      if (updateError) throw updateError;
      console.log('✅ User metadata updated:', userData);

      // Refresh the session to reflect the changes
      console.log('🔄 Refreshing session...');
      const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError) throw sessionError;
      console.log('✅ Session refreshed:', sessionData);

      console.log('🎉 Application process completed successfully!');
      
      // Redirect to pending page
      navigate('/pending');

    } catch (error) {
      console.error('❌ Error in application process:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFBF00]"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <motion.div
        className="absolute inset-0"
        animate={{
          y: showForm ? '-100%' : '0%'
        }}
        transition={{
          duration: 0.4,
          ease: [0.8, 0.2, 0.2, 0.8]
        }}
      >
        <Retro2Intro onComplete={() => setShowForm(true)} />
      </motion.div>

      <motion.div
        className="absolute inset-0"
        initial={{ y: '100%' }}
        animate={{
          y: showForm ? '0%' : '100%'
        }}
        transition={{
          duration: 0.4,
          ease: [0.8, 0.2, 0.2, 0.8]
        }}
      >
        <Retro2Form questions={questions} onSubmit={handleSubmit} />
      </motion.div>
    </div>
  );
}