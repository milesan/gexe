import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { ApplicationQuestion } from '../../types/application';

interface Props {
  question: ApplicationQuestion;
  value: any;
  onChange: (value: any) => void;
  onAutoAdvance?: () => void;
  themeColor?: string;
}

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP'
];

export function RetroQuestionField({ question, value, onChange, onAutoAdvance, themeColor = 'garden-gold' }: Props) {
  const isConsentQuestion = question.order_number === 3;
  const isMBTIQuestion = question.text.toLowerCase().includes('mbti');

  if (isMBTIQuestion) {
    return (
      <div className="space-y-6">
        <h3 className="text-2xl font-display">
          {question.text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {MBTI_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => onChange(type)}
              className={`p-4 pixel-corners transition-all ${
                value === type 
                  ? `bg-${themeColor} text-garden-dark` 
                  : `bg-garden-dark/30 hover:bg-${themeColor}/20`
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === 'radio' && question.options) {
    const options = Array.isArray(question.options) 
      ? question.options 
      : JSON.parse(question.options);

    const handleChange = (option: string) => {
      onChange(option);
      if (isConsentQuestion && option === 'Yes' && onAutoAdvance) {
        onAutoAdvance();
      }
    };

    return (
      <div className="space-y-6">
        {isConsentQuestion ? (
          <motion.div 
            className="space-y-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            <div className="relative">
              <div className={`absolute -left-8 top-0 bottom-0 w-2 bg-${themeColor}/20`} />
              <motion.div 
                className="space-y-8 pl-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
              >
                <pre className={`font-display text-${themeColor}/60 text-sm`}>
{`
╔═══════════════
     COMPLETING THIS        
   APPLICATION IS NOT A     
   CONFIRMED ENTRY TO THE   
         GARDEN             
  ════════════════╝
`}
                </pre>

                <div className="space-y-6 font-display text-3xl leading-relaxed">
                  <p className={`text-${themeColor}/90`}>This is a curated place, unlike any other.</p>
                  
                  <p className={`text-${themeColor}/80`}>We seek those with the attention span & curiosity 
                  to complete this application. This is a filter, not a funnel. 
                  If we lose you, that's self-selection.</p>
                  
                  <p className={`text-${themeColor}/70`}>We're not impressed by your followers, fortune, 
                  or fame [though none of those exclude you]. We seek the realest.</p>
                </div>

                <pre className={`font-display text-${themeColor}/40 text-sm`}>
{`
▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄
`}
                </pre>
              </motion.div>
            </div>

            <motion.div 
              className="pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
            >
              <h3 className={`text-2xl font-display mb-8 text-${themeColor}/90`}>
                Do you consent to your data being stored and reviewed for this experience?
              </h3>
              <div className="flex justify-center gap-12">
                {options.map((option: string) => (
                  <button 
                    key={option} 
                    onClick={() => handleChange(option)}
                    className={`w-48 h-24 pixel-corners font-display text-3xl transition-all ${
                      value === option 
                        ? `bg-${themeColor}/20 text-${themeColor}` 
                        : `bg-garden-dark/30 hover:bg-${themeColor}/10 text-${themeColor}/60`
                    }`}
                  >
                    [{option}]
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <>
            <h3 className="text-2xl font-display">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </h3>
            <div className="space-y-4">
              {options.map((option: string) => {
                const isSelected = value === option;
                return (
                  <label 
                    key={option} 
                    className={`flex items-center p-6 pixel-corners cursor-pointer transition-all ${
                      isSelected 
                        ? `bg-${themeColor}/20` 
                        : `hover:bg-${themeColor}/10`
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 pixel-corners mr-4 flex items-center justify-center transition-colors ${
                      isSelected 
                        ? `border-2 border-${themeColor} bg-${themeColor}` 
                        : `border-2 border-${themeColor}`
                    }`}>
                      {isSelected && <Check className="w-5 h-5 text-garden-dark" />}
                    </div>
                    <input
                      type="radio"
                      name={`question-${question.order_number}`}
                      value={option}
                      checked={isSelected}
                      onChange={() => handleChange(option)}
                      className="sr-only"
                      required={question.required}
                    />
                    <span className="text-xl">{option}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  if (question.type === 'textarea') {
    return (
      <div className="space-y-4">
        <h3 className="text-2xl font-display">
          {question.text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        <div className="relative">
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full min-h-[200px] p-6 bg-garden-dark/30 text-xl pixel-corners retro-input text-${themeColor} border-${themeColor}`}
            required={question.required}
          />
          <div className="caret absolute top-6 left-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-display">
        {question.text}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </h3>
      <div className="relative">
        <input
          type={question.type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full p-6 bg-garden-dark/30 text-xl pixel-corners retro-input text-${themeColor} border-${themeColor}`}
          required={question.required}
        />
        <div className="caret absolute top-6 left-6" />
      </div>
    </div>
  );
}