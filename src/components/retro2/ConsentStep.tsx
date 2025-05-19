import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { ApplicationQuestion } from '../../types/application';
import { SignUpHeader } from './SignUpHeader'; // Import the new header

interface Props {
  question: ApplicationQuestion; // Expecting the specific consent question object
  onConsent: () => void; // Callback for 'Yes'
  onReject: () => void;  // Callback for 'No'
}

// Styling and content copied & adapted from RetroQuestionField's consent section
export function ConsentStep({ question, onConsent, onReject }: Props) {
  const [isPricingVisible, setIsPricingVisible] = useState(false); // Added state for dropdown

  // Improved options handling logic with better logging
  let options;
  
  if (Array.isArray(question.options)) {
    // If options is already an array, use it directly
    options = question.options;
    console.log('ConsentStep: options is already an array:', options);
  } else if (typeof question.options === 'string') {
    // If options is a string, try to parse it (handles JSON format from DB)
    try {
      options = JSON.parse(question.options);
      console.log('ConsentStep: parsed options from string:', options);
    } catch (e) {
      console.error('ConsentStep: Error parsing options string:', question.options, e);
      options = ["Yes", "No"]; // Fallback if parsing fails
    }
  } else {
    // If options is undefined or any other type, use default
    console.warn('ConsentStep: No options found, using default. Question:', question);
    options = ["Yes", "No"];
  }

  const handleOptionClick = (option: string) => {
    // Affirmative options
    if (option.toLowerCase() === 'yes' || option.toLowerCase() === 'as you wish.') {
      onConsent();
    } else {
      // Any other option is considered a rejection (e.g., "No", "Inconceivable!")
      onReject();
    }
  };

  return (
    <div className="min-h-screen bg-black text-retro-accent font-mono flex flex-col">
      <SignUpHeader />
      <div className="flex-grow p-4">
        <motion.div
          className="space-y-12 max-w-lg w-full mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
        >
          {/* Intro Text */}
          <div className="relative">
            <div className="absolute -left-2 sm:-left-8 top-0 bottom-0 w-1 sm:w-2 bg-gradient-to-b from-retro-accent/60 via-retro-accent/40 to-retro-accent/20" />
            <motion.div
              className="space-y-6 pl-2 sm:pl-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }} // Slightly shorter delay than original
            >
              <div className="space-y-4 font-display text-base leading-relaxed">
                <p className="text-retro-accent/60">This is a curated place, unlike any other.</p>
                <p className="text-retro-accent/70">We seek those with the attention span & curiosity to complete this application.</p>
                <p className="text-retro-accent/80">We're not impressed by your followers, fortune, or fame [though none of those exclude you].</p>
                <p className="text-retro-accent text-2xl">We seek the realest.</p>
              </div>
            </motion.div>
          </div>

          {/* === Pricing Dropdown START === */}
          <div className="text-center py-4">
            <button
              onClick={() => setIsPricingVisible(!isPricingVisible)}
              className="text-retro-accent/80 hover:text-retro-accent font-display text-base underline underline-offset-4 focus:outline-none"
            >
              {isPricingVisible ? 'Hide Rates' : 'View Rates & Details'}
            </button>
            <motion.div
              initial={false} // No initial animation on load, controlled by animate prop
              animate={{
                opacity: isPricingVisible ? 1 : 0,
                height: isPricingVisible ? 'auto' : 0,
                marginTop: isPricingVisible ? '1rem' : '0rem' // Add some margin when open
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-2 pb-4 space-y-1">
                <p className="text-sm text-retro-accent/70">
                  Rates are €33-€150/night (includes food, facilities, lodging).
                </p>
                <p className="text-sm text-retro-accent/70">
                  €20/night if you bring your own lodging.
                </p>
              </div>
            </motion.div>
          </div>
          {/* === Pricing Dropdown END === */}

          {/* Consent Question & Buttons */}
          <motion.div
            className="pt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }} // Adjusted delay from 0.5
          >
            <h3 className="text-xl font-display mb-2 text-retro-accent/90">
              {/* Using question.text allows flexibility if the wording changes */}
              {question.text || "Do you consent to your data being stored and reviewed?"}
            </h3>
            <p className="text-sm text-retro-accent/60 -mt-1 mb-6">
              We value data privacy. Your application data will be handled securely.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-8">
              {options.map((option: string) => (
                <button
                  key={option}
                  onClick={() => handleOptionClick(option)}
                  className="w-full sm:w-auto bg-retro-accent text-black px-6 py-3 text-lg transition-colors hover:bg-accent-secondary"
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
      </div>
    </div>
  );
} 