import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceSession } from './useVoiceSession';

interface VoiceInterfaceProps {
  questions: any[];
  onAnswerUpdate: (questionId: string, answer: any) => void;
  onComplete: () => void;
  currentQuestionIndex: number;
  onQuestionChange: (index: number) => void;
  formData: Record<string, any>;
}

export function VoiceInterface({
  questions,
  onAnswerUpdate,
  onComplete,
  currentQuestionIndex,
  onQuestionChange,
  formData
}: VoiceInterfaceProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const {
    isConnected,
    isConnecting,
    error: sessionError,
    startSession,
    endSession,
    sendMessage,
    currentResponse
  } = useVoiceSession();

  const currentQuestion = questions[currentQuestionIndex];
  const speechSynthesis = window.speechSynthesis;
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setVoiceError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError('');
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setTranscript(transcript);
      
      if (event.results[current].isFinal) {
        handleTranscriptComplete(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setVoiceError(`Error: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [currentQuestionIndex]);

  // Speak the current question
  const speakQuestion = () => {
    if (!currentQuestion || isSpeaking) return;

    const utterance = new SpeechSynthesisUtterance(currentQuestion.text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-start listening after speaking the question
      setTimeout(() => startListening(), 500);
    };

    speechSynthesis.speak(utterance);
  };

  // Start listening for user input
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        setVoiceError('Could not start voice recognition. Please try again.');
      }
    }
  };

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // Handle completed transcript
  const handleTranscriptComplete = async (finalTranscript: string) => {
    setIsProcessing(true);
    
    try {
      // Process the answer based on question type
      let processedAnswer = finalTranscript;
      
      if (currentQuestion.type === 'radio') {
        // Try to match the transcript to available options
        const options = JSON.parse(currentQuestion.options || '[]');
        const matchedOption = options.find((opt: string) => 
          finalTranscript.toLowerCase().includes(opt.toLowerCase()) ||
          opt.toLowerCase().includes(finalTranscript.toLowerCase())
        );
        processedAnswer = matchedOption || finalTranscript;
      } else if (currentQuestion.type === 'date') {
        // Parse date from natural language
        // This would need more sophisticated date parsing
        processedAnswer = finalTranscript;
      }
      
      // Save the answer
      onAnswerUpdate(currentQuestion.id, processedAnswer);
      
      // Move to next question
      if (currentQuestionIndex < questions.length - 1) {
        onQuestionChange(currentQuestionIndex + 1);
        // Speak the next question after a short delay
        setTimeout(() => speakQuestion(), 1000);
      } else {
        // All questions answered
        speakCompletion();
      }
    } catch (error) {
      console.error('Error processing transcript:', error);
      setVoiceError('Could not process your answer. Please try again.');
    } finally {
      setIsProcessing(false);
      setTranscript('');
    }
  };

  // Speak completion message
  const speakCompletion = () => {
    const utterance = new SpeechSynthesisUtterance(
      "Great! You've completed all the questions. Please review your answers and submit when ready."
    );
    utterance.onend = () => {
      onComplete();
    };
    speechSynthesis.speak(utterance);
  };

  // Toggle voice mode
  const toggleVoiceMode = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Auto-start voice interaction on mount
  useEffect(() => {
    // Give user a moment to prepare, then start
    const timer = setTimeout(() => {
      speakQuestion();
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-black/50 backdrop-blur-sm rounded-lg border border-retro-accent/30">
      {/* Current Question Display */}
      <div className="w-full max-w-2xl mb-8">
        <div className="text-center mb-4">
          <span className="text-retro-accent-dim text-sm font-mono">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>
        
        <motion.h2
          key={currentQuestion?.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl text-retro-accent font-mono text-center mb-6"
        >
          {currentQuestion?.text}
        </motion.h2>

        {/* Voice Visualization */}
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{
              scale: isListening ? [1, 1.2, 1] : 1,
              opacity: isListening ? [0.5, 1, 0.5] : 1
            }}
            transition={{
              duration: 1.5,
              repeat: isListening ? Infinity : 0
            }}
            className={`relative w-32 h-32 rounded-full flex items-center justify-center ${
              isListening ? 'bg-retro-accent/20' : 'bg-retro-accent/10'
            }`}
          >
            <button
              onClick={toggleVoiceMode}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isListening 
                  ? 'bg-retro-accent text-black' 
                  : 'bg-black border-2 border-retro-accent text-retro-accent hover:bg-retro-accent hover:text-black'
              }`}
            >
              {isListening ? (
                <Mic className="w-10 h-10" />
              ) : (
                <MicOff className="w-10 h-10" />
              )}
            </button>
            
            {/* Listening pulse effect */}
            {isListening && (
              <>
                <div className="absolute inset-0 rounded-full bg-retro-accent/20 animate-ping" />
                <div className="absolute inset-0 rounded-full bg-retro-accent/10 animate-ping animation-delay-200" />
              </>
            )}
          </motion.div>
        </div>

        {/* Transcript Display */}
        <AnimatePresence>
          {transcript && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 bg-retro-accent/10 border border-retro-accent/30 rounded"
            >
              <p className="text-retro-accent font-mono text-sm">
                {transcript}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-retro-accent-dim">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-mono">Processing your answer...</span>
          </div>
        )}

        {/* Error Display */}
        {voiceError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{voiceError}</p>
          </motion.div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => speakQuestion()}
            disabled={isSpeaking}
            className="px-4 py-2 bg-black border border-retro-accent text-retro-accent font-mono text-sm hover:bg-retro-accent hover:text-black transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Volume2 className="w-4 h-4" />
            Repeat Question
          </button>
          
          <button
            onClick={() => onQuestionChange(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 bg-black border border-retro-accent text-retro-accent font-mono text-sm hover:bg-retro-accent hover:text-black transition-colors disabled:opacity-50"
          >
            Previous
          </button>
          
          <button
            onClick={() => onQuestionChange(Math.min(questions.length - 1, currentQuestionIndex + 1))}
            disabled={currentQuestionIndex === questions.length - 1}
            className="px-4 py-2 bg-black border border-retro-accent text-retro-accent font-mono text-sm hover:bg-retro-accent hover:text-black transition-colors disabled:opacity-50"
          >
            Next
          </button>
        </div>

        {/* Current Answer Display */}
        {formData[currentQuestion?.id] && (
          <div className="mt-4 p-3 bg-retro-accent/5 border border-retro-accent/20 rounded">
            <p className="text-retro-accent-dim text-sm font-mono">
              Current answer: {formData[currentQuestion.id]}
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        .animation-delay-200 {
          animation-delay: 200ms;
        }
      `}</style>
    </div>
  );
}