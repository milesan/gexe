import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import type { ApplicationQuestion } from '../../types/application';
import { ImageModal } from '../shared/ImageModal';

interface ApplicationDetailsProps {
  application: any;
  onClose: () => void;
}

export function ApplicationDetails({ application, onClose }: ApplicationDetailsProps) {
  const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderedAnswers, setOrderedAnswers] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const { data, error } = await supabase
          .from('application_questions')
          .select('*')
          .order('order_number');
        
        if (error) throw error;
        setQuestions(data || []);
        
        // Create ordered array of answers based on question order_numbers
        if (data && application.data) {
          const answers = data.map(q => application.data[q.order_number]);
          setOrderedAnswers(answers);
        }
      } catch (err) {
        console.error('Error loading questions:', err);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [application.data]);

  const sections = Array.from(new Set(questions.map(q => q.section)));

  // Get applicant's name from the ordered answers array
  const firstName = orderedAnswers[1] || ''; // First name should be the second question
  const lastName = orderedAnswers[2] || '';  // Last name should be the third question

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

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-medium">
                {firstName} {lastName}
              </h2>
              <p className="text-sm text-stone-600">{application.user_email}</p>
            </div>
            <button 
              onClick={onClose} 
              className="text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {sections.map((section) => (
                <div key={section} className="mb-8">
                  <h3 className="text-lg font-medium text-stone-900 mb-4">{section}</h3>
                  <div className="space-y-6">
                    {questions
                      .filter(q => q.section === section)
                      .map((question, index) => {
                        // Find the question's position in the overall questions array
                        const questionIndex = questions.findIndex(q => q.id === question.id);
                        const answer = orderedAnswers[questionIndex];
                        
                        console.log('Question:', {
                          id: question.id,
                          type: question.type,
                          text: question.text,
                          answer: answer
                        });
                        
                        return (
                          <div key={question.id} className="bg-stone-50 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-stone-900 mb-2">
                              {question.text}
                            </h4>
                            <div className="text-stone-600 whitespace-pre-wrap">
                              {question.type === 'file' ? (
                                renderPhotoGrid(answer)
                              ) : (
                                typeof answer === 'object' ? answer?.selection : answer || 'No response'
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
}