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

// Helper function to parse options safely (similar to the other RetroQuestionField)
const parseOptions = (options?: string | string[]): string[] => {
  // If options is already an array, return it
  if (Array.isArray(options)) {
    return options;
  }
  
  // If options is a string, try to parse it
  if (typeof options === 'string' && options) {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('[Retro2QuestionField] Failed to parse question.options JSON string:', options, error);
      return [];
    }
  }
  
  // Default case: no options or invalid format
  return [];
};

export function RetroQuestionField({ question, value, onChange, onAutoAdvance, themeColor = 'garden-gold' }: Props) {
  const isConsentQuestion = question.section === 'intro';

  const handleNoConsent = () => {
    window.location.href = 'https://www.youtube.com/watch?v=xvFZjo5PgG0';
  };

  if (question.type === 'radio' && question.options) {
    const options = parseOptions(question.options);

    const handleChange = (option: string) => {
      if (isConsentQuestion && option === 'No') {
        handleNoConsent();
        return;
      }
      onChange(option);
      if (isConsentQuestion && option === 'Yes' && onAutoAdvance) {
        setTimeout(() => {
          onAutoAdvance();
        }, 500);
      }
    };

    return (
      <div className="space-y-4">
        {isConsentQuestion ? (
          <motion.div 
            className="space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            <div className="relative">
              <div className="absolute -left-8 top-0 bottom-0 w-2 bg-gradient-to-b from-[#FFBF00]/60 via-[#FFBF00]/40 to-[#FFBF00]/20" />
              <motion.div 
                className="space-y-6 pl-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
              >
                <div className="space-y-4 font-display text-base leading-relaxed max-w-lg">
                  <p className="text-[#FFBF00]/60">This is a curated place, unlike any other.</p>
                  <p className="text-[#FFBF00]/70">We seek those with the attention span & curiosity 
                  to complete this application.</p>
                  <p className="text-[#FFBF00]/80">We're not impressed by your followers, fortune, 
                  or fame [though none of those exclude you].</p>
                  <p className="text-[#FFBF00] text-2xl">We s2eek the realest.</p>
                </div>
              </motion.div>
            </div>

            <motion.div 
              className="pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
            >
              <h3 className="text-xl font-display mb-2 text-[#FFBF00]/90">
                Do you consent to your data being stored and reviewed?
              </h3>
              <p className="text-sm text-[#FFBF00]/60 -mt-1 mb-6">
                We value data privacy.
              </p>
              <div className="flex justify-center gap-8">
                {options.map((option: string) => (
                  <button 
                    key={option} 
                    onClick={() => handleChange(option)}
                    className="bg-[#FFBF00] text-black px-6 py-3 text-lg transition-colors hover:bg-[#FFBF00]/90"
                    style={{
                      clipPath: `polygon(
                        0 4px, 4px 4px, 4px 0,
                        calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                        100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                        calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                        0 calc(100% - 4px)
                      )`
                    }}
                  >
                    {option}
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
            <div className="space-y-2">
              {options.map((option: string) => {
                const isSelected = value === option;
                return (
                  <label 
                    key={option} 
                    className={`flex items-center p-3 cursor-pointer transition-all ${
                      isSelected 
                        ? `bg-[#FFBF00]/20` 
                        : `hover:bg-[#FFBF00]/10`
                    }`}
                    style={{
                      clipPath: `polygon(
                        0 4px, 4px 4px, 4px 0,
                        calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                        100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                        calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                        0 calc(100% - 4px)
                      )`
                    }}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 mr-4 flex items-center justify-center transition-colors ${
                      isSelected 
                        ? `border-4 border-[#FFBF00] bg-[#FFBF00]` 
                        : `border-4 border-[#FFBF00]`
                    }`}
                    style={{
                      clipPath: `polygon(
                        0 4px, 4px 4px, 4px 0,
                        calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                        100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                        calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                        0 calc(100% - 4px)
                      )`
                    }}
                    >
                      {isSelected && <Check className="w-4 h-4 text-black" />}
                    </div>
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={isSelected}
                      onChange={() => handleChange(option)}
                      className="sr-only"
                      required={!!question.required}
                    />
                    <span className="text-base text-[#FFBF00]">{option}</span>
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
        <h3 className="text-2xl font-display text-[#FFBF00]">
          {question.text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        <div className="relative">
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-black p-3 text-[#FFBF00] focus:outline-none focus:ring-2 focus:ring-[#FFBF00] placeholder-[#FFBF00]/30 border-4 border-[#FFBF00]/30"
            rows={4}
            required={!!question.required}
            style={{
              clipPath: `polygon(
                0 4px, 4px 4px, 4px 0,
                calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
                100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
                calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
                0 calc(100% - 4px)
              )`
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-display text-[#FFBF00]">
        {question.text}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </h3>
      <div className="relative">
        <input
          type={question.type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-black p-3 text-[#FFBF00] focus:outline-none focus:ring-2 focus:ring-[#FFBF00] placeholder-[#FFBF00]/30 border-4 border-[#FFBF00]/30"
          required={!!question.required}
          style={{
            clipPath: `polygon(
              0 4px, 4px 4px, 4px 0,
              calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
              100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px),
              calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px),
              0 calc(100% - 4px)
            )`
          }}
        />
      </div>
    </div>
  );
}