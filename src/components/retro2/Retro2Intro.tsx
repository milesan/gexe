import React, { useState, useEffect } from 'react';
// motion can be removed if not used after this change, but let's keep it for now
// import { motion } from 'framer-motion';

interface Props {
  onComplete: () => void;
}

const ASCII_ART = `████████╗██╗  ██╗███████╗     ██████╗  █████╗ ██████╗ ██████╗ ███████╗███╗   ██╗
╚══██╔══╝██║  ██║██╔════╝    ██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗  ██║
   ██║   ███████║█████╗      ██║  ███╗███████║██████╔╝██║  ██║█████╗  ██╔██╗ ██║
   ██║   ██╔══██║██╔══╝      ██║   ██║██╔══██║██╔══██╗██║  ██║██╔══╝  ██║╚██╗██║
   ██║   ██║  ██║███████╗    ╚██████╔╝██║  ██║██║  ██║██████╔╝███████╗██║ ╚████║
   ╚═╝   ╚═╝  ╚═╝╚══════╝     ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝`;

const MOBILE_ASCII_ART = ` `;

export function Retro2Intro({ onComplete }: Props) {
  console.log('[Retro2Intro] Component rendering');
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const asciiLines = ASCII_ART.split('\n'); // Use full ASCII_ART by default
  const isMobile = window.innerWidth < 600; // Changed from 768 to 600

  useEffect(() => {
    console.log('[Retro2Intro] Component mounted/resetting');
    // No need to setDisplayedLines([])
    setCurrentLine(0);
    setCurrentChar(0);
  }, []); // Empty dependency array means this runs on mount and if onComplete changes (which it shouldn't)

  useEffect(() => {
    // Skip animation on mobile
    if (isMobile) {
      console.log('[Retro2Intro] Mobile detected (width < 600px), skipping animation.');
      onComplete();
      return;
    }

    if (currentLine >= asciiLines.length) {
      console.log('[Retro2Intro] All lines displayed, waiting before completion');
      const timer = setTimeout(() => {
        console.log('[Retro2Intro] Calling onComplete');
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }

    const line = asciiLines[currentLine];
    if (currentChar >= line.length) {
      console.log('[Retro2Intro] Line complete, moving to next line');
      // No longer setting displayedLines
      const lineCompleteTimer = setTimeout(() => {
        setCurrentLine(prev => prev + 1);
        setCurrentChar(0);
      }, 75);
      return () => clearTimeout(lineCompleteTimer);
    }

    const charTimer = setTimeout(() => {
      setCurrentChar(prev => prev + 1);
    }, 5);

    return () => clearTimeout(charTimer);
  }, [currentLine, currentChar, asciiLines, onComplete, isMobile]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 overflow-hidden">
      {/* Conditionally render pre only if not mobile, or let the fast onComplete handle it */}
      {!isMobile && (
        <pre 
          className="text-retro-accent whitespace-pre font-mono text-sm md:text-base lg:text-lg overflow-x-auto max-w-full"
          style={{
            maxHeight: '90vh',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            fontFamily: 'monospace'
          }}
        >
          {asciiLines
            .slice(0, currentLine + 1)
            .map((lineText, index) => {
              if (index === currentLine) {
                return lineText.slice(0, currentChar);
              }
              return lineText;
            })
            .join('\n')}
        </pre>
      )}
      {/* If mobile, this div will be mostly empty and onComplete would have been called */}
    </div>
  );
}