import React, { useState, useEffect, useRef } from 'react';

interface OptimizedSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  onDisplayValueChange?: (value: number) => void; // For immediate feedback while dragging
  id?: string;
  className?: string;
}

export function OptimizedSlider({
  min,
  max,
  value,
  onChange,
  onDisplayValueChange,
  id,
  className = "w-full h-2 bg-border rounded-sm appearance-none cursor-pointer accent-accent-primary slider-thumb-accent"
}: OptimizedSliderProps) {
  // Local state for immediate visual feedback
  const [localValue, setLocalValue] = useState(value);
  const isDragging = useRef(false);
  
  // Sync local value with prop when it changes externally
  useEffect(() => {
    if (!isDragging.current) {
      setLocalValue(value);
    }
  }, [value]);
  
  const handleMouseDown = () => {
    isDragging.current = true;
  };
  
  const handleMouseUp = () => {
    isDragging.current = false;
    // Commit the final value
    if (localValue !== value) {
      onChange(localValue);
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    setLocalValue(newValue);
    
    // Call the display value change handler immediately for visual feedback
    if (onDisplayValueChange) {
      onDisplayValueChange(newValue);
    }
    
    // For keyboard navigation, update immediately
    if (!isDragging.current) {
      onChange(newValue);
    }
  };
  
  // Ensure mouse up is captured even if mouse leaves the slider
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        if (localValue !== value) {
          onChange(localValue);
        }
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [localValue, value, onChange]);
  
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      value={localValue}
      onChange={handleChange}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      className={className}
    />
  );
} 