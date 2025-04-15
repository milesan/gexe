import React, { useState, useRef, useLayoutEffect } from 'react';
import clsx from 'clsx';

interface FitTextProps {
  text: string;
  className?: string;
  minFontSizePx: number;
  maxFontSizePx: number;
  stepPx?: number; // How much to decrease font size each iteration
}

// Debounce function to limit resize calculations
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), waitFor);
  };
}

export const FitText: React.FC<FitTextProps> = ({
  text,
  className,
  minFontSizePx,
  maxFontSizePx,
  stepPx = 0.5, // Default step
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  // Store the calculated font size, initially the max
  const [currentFontSize, setCurrentFontSize] = useState<number>(maxFontSizePx);

  console.log(`[FitText] Rendering: "${text}", initial max size: ${maxFontSizePx}`);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;

    if (!container || !textEl) {
      console.log('[FitText] Refs not ready.');
      return;
    }

    const calculateFontSize = () => {
      console.log('[FitText] Calculating font size...');
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;

      if (containerWidth <= 0 || containerHeight <= 0) {
        console.warn('[FitText] Container has zero dimensions. Skipping calculation.');
        return; // Avoid calculations if container isn't rendered properly
      }

      let testFontSize = maxFontSizePx;
      textEl.style.fontSize = `${testFontSize}px`;

      // Check initial fit with max size
      let fits = textEl.scrollWidth <= containerWidth && textEl.scrollHeight <= containerHeight;
      console.log(`[FitText] Initial check at ${testFontSize}px: fits=${fits}, text=(${textEl.scrollWidth}x${textEl.scrollHeight}), container=(${containerWidth}x${containerHeight})`);

      // Iterate downwards if it doesn't fit
      while (!fits && testFontSize > minFontSizePx) {
        testFontSize = Math.max(testFontSize - stepPx, minFontSizePx); // Decrease font size, but not below min
        textEl.style.fontSize = `${testFontSize}px`;
        fits = textEl.scrollWidth <= containerWidth && textEl.scrollHeight <= containerHeight;
        console.log(`[FitText] Testing ${testFontSize}px: fits=${fits}, text=(${textEl.scrollWidth}x${textEl.scrollHeight}), container=(${containerWidth}x${containerHeight})`);
      }

      console.log(`[FitText] Final size determined: ${testFontSize}px`);
      setCurrentFontSize(testFontSize);
    };

    // Debounce the calculation for resize events
    const debouncedCalculate = debounce(calculateFontSize, 100);

    // Initial calculation
    calculateFontSize();

    // Use ResizeObserver to recalculate on container resize
    const resizeObserver = new ResizeObserver(entries => {
        console.log('[FitText] Resize detected.');
        debouncedCalculate();
    });

    resizeObserver.observe(container);

    // Cleanup observer on unmount
    return () => {
      console.log('[FitText] Cleaning up observer.');
      resizeObserver.disconnect();
    };
    // Dependencies: recalculate if text or boundaries change
  }, [text, minFontSizePx, maxFontSizePx, stepPx]); 

  // Styles for the container and text span
  const containerStyle: React.CSSProperties = {
    overflow: 'hidden', // Crucial to prevent visual overflow during calculation/render
    width: '100%',      // Take full width of parent
    // Height will be determined by parent or content
  };

  const textStyle: React.CSSProperties = {
    display: 'inline-block', // Allows scrollWidth/Height measurement
    whiteSpace: 'normal',    // Allow normal wrapping
    overflowWrap: 'break-word', // Still allow breaking long words *if necessary* at the final size
    fontSize: `${currentFontSize}px`,
    lineHeight: '1.2', // Or adjust as needed
    // Add transitions for smoother size changes? Optional.
    // transition: 'font-size 0.1s ease-out',
  };

  return (
    <div ref={containerRef} style={containerStyle} className={className}>
      {/* The actual text span that gets measured and styled */}
      <span ref={textRef} style={textStyle}>
        {text}
      </span>
    </div>
  );
}; 